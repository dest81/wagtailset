const React = window.React;
const RichUtils = window.DraftJS.RichUtils;
const Modifier = window.DraftJS.Modifier;
const TooltipEntity = window.draftail.TooltipEntity;
const Icon = window.wagtail.components.Icon;
const EditorState = window.DraftJS.EditorState;
const Portal = window.wagtail.components.Portal;
const Tooltip = window.draftail.Tooltip;

// import PropTypes from "prop-types";
import slugify from "slugify";

const shortenLabel = label => {
  let shortened = label;
  if (shortened.length > 25) {
    shortened = `${shortened.slice(0, 20)}…`;
  }

  return shortened;
};

const gettext = text => {
  const djangoGettext = window.django?.gettext;

  if (djangoGettext) {
    return djangoGettext(text);
  }

  return text;
}

const LINK_ICON = <Icon name="link" />;
const BROKEN_LINK_ICON = <Icon name="warning" />;
const MAIL_ICON = <Icon name="mail" />;

const getEmailAddress = mailto => mailto.replace("mailto:", "").split("?")[0];
const getPhoneNumber = tel => tel.replace("tel:", "").split("?")[0];
const getDomainName = url => url.replace(/(^\w+:|^)\/\//, "").split("/")[0];

// Determines how to display the link based on its type: page, mail, hash or external.
const getLinkAttributes = data => {
  const url = data.url || null;
  let icon;
  let label;

  if (!url) {
    icon = BROKEN_LINK_ICON;
    label = gettext("Broken link");
  } else if (data.id) {
    icon = LINK_ICON;
    label = url;
  } else if (url.startsWith("mailto:")) {
    icon = MAIL_ICON;
    label = getEmailAddress(url);
  } else if (url.startsWith("tel:")) {
    icon = LINK_ICON;
    label = getPhoneNumber(url);
  } else if (url.startsWith("#")) {
    icon = LINK_ICON;
    label = url;
  } else {
    icon = LINK_ICON;
    label = getDomainName(url);
  }

  return {
    url,
    icon,
    label,
  };
};

const djangoUserRegex =
  /(^[-!#$%&'*+/=?^_`{}|~0-9A-Z]+(\.[-!#$%&'*+/=?^_`{}|~0-9A-Z]+)*$|^"([\001-\010\013\014\016-\037!#-[\]-\177]|\\[\001-\011\013\014\016-\177])*"$)/i;
// Compared to Django, changed to remove the end-of-domain `-` check that was done with a negative lookbehind `(?<!-)` (unsupported in Safari), and disallow all TLD hyphens instead.
// const djangoDomainRegex = /((?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+)(?:[A-Z0-9-]{2,63}(?<!-))$/i;
const djangoDomainRegex = /((?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+)(?:[A-Z0-9]{2,63})$/i;
/**
 * See https://docs.djangoproject.com/en/4.0/_modules/django/core/validators/#URLValidator.
 */
const djangoSchemes = ["http:", "https:", "ftp:", "ftps:"];

const getValidLinkURL = (text, schemes) => {
  if (text.includes("@")) {
    const [user, domain] = text.split("@");
    if (djangoUserRegex.test(user) && djangoDomainRegex.test(domain)) {
      return `mailto:${text}`;
    }
  }

  try {
    const url = new URL(text);

    if (schemes.includes(url.protocol)) {
      return text;
    }
  } catch (e) {
    return false;
  }

  return false;
};

const onPasteLink = (text, html, editorState, { setEditorState }) => {
  const url = getValidLinkURL(text, djangoSchemes);
  if (!url) {
    return "not-handled";
  }

  const selection = editorState.getSelection();
  let content = editorState.getCurrentContent();
  content = content.createEntity("LINK", "MUTABLE", { url });
  const entityKey = content.getLastCreatedEntityKey();
  let nextState;

  if (selection.isCollapsed()) {
    content = Modifier.insertText(content, selection, text, undefined, entityKey);
    nextState = EditorState.push(editorState, content, "insert-characters");
  } else {
    nextState = RichUtils.toggleLink(editorState, selection, entityKey);
  }

  setEditorState(nextState);
  return "handled";
};

const buttonContainerStyle = {
   float: 'right'
}

class Link extends TooltipEntity {
  constructor(props) {
    super(props);
    this.onSetHash = this.onSetHash.bind(this);
    this.onRemoveHash = this.onRemoveHash.bind(this);
  }

  onSetHash(e) {
    e.preventDefault();
    e.stopPropagation();

    const { entityKey, contentState } = this.props;
    const data = contentState.getEntity(entityKey).getData();

    const hash = window.prompt("Hash Link:", data.hash || "");

    if (hash != null && hash !== data.hash) {
      this.setHash(slugify(hash));
    }
  }

  onRemoveHash(e) {
    e.preventDefault();
    e.stopPropagation();
    this.setHash(null);
  }

  setHash(hash) {
    const editorState = this.props.getEditorState();
    let newEditorState = editorState;
    let content = editorState.getCurrentContent();
    const { entityKey } = this.props;
    let nextContent = content.mergeEntityData(entityKey, { hash: hash });

    const selection = editorState.getSelection();
    content = Modifier.mergeBlockData(nextContent, selection, { hash: hash });

    newEditorState = EditorState.push(editorState, content, editorState.getLastChangeType());
    newEditorState = EditorState.acceptSelection(newEditorState, selection);
    this.props.setEditorState(newEditorState);
  }

  render() {
    const { entityKey, contentState, children } = this.props;
    const data = contentState.getEntity(entityKey).getData();

    const { icon, label, url } = getLinkAttributes(data);
    const { showTooltipAt } = this.state;
    const hash = data.hash || "";

    const isInternalLink = data.id ? true : false;

    let fullUrl = url;
    if (isInternalLink && hash) {
      fullUrl = `${url}#{hash}`;
    }

    return (
      <a
        href={url}
        role="button"
        // Use onMouseUp to preserve focus in the text even after clicking.
        onMouseUp={this.openTooltip}
        className="TooltipEntity"
        data-draftail-trigger
      >
        {icon}
        {children}
        {showTooltipAt && (
          <Portal
            node={showTooltipAt.container}
            onClose={this.closeTooltip}
            closeOnClick
            closeOnType
            closeOnResize
          >
            <Tooltip target={showTooltipAt} direction="top">
              <div>
                  <a
                    href={fullUrl}
                    title={url}
                    target="_blank"
                    rel="noreferrer"
                    className="Tooltip__link"
                  >
                    {shortenLabel(label)}
                  </a>
                <div style={ buttonContainerStyle }>
                  <button className="button button-small Tooltip__button" onClick={this.onEdit}>
                    Edit
                  </button>

                  <button
                    className="button button-small button-secondary no Tooltip__button"
                    onClick={this.onRemove}
                  >
                    Remove
                  </button>
                </div>
              </div>
              {isInternalLink &&
              <div>
              <hr />
                  <a
                    href={fullUrl}
                    title={url}
                    target="_blank"
                    rel="noreferrer"
                    className="Tooltip__link"
                    style={{ marginTop: '-1em' }}
                  >
                    Anchor: <br /> #{shortenLabel(hash)}
                  </a>
                <div style={ buttonContainerStyle }>
                  <button className="button button-small Tooltip__button" onClick={this.onSetHash}>
                    {hash ? "Edit" : "Add"}
                  </button>
                  <button
                    className="button button-small button-secondary no Tooltip__button"
                    onClick={this.onRemoveHash}
                  >
                    Remove
                  </button>
                </div>
              </div>
              }
            </Tooltip>
          </Portal>
        )}
      </a>
    );
  }
}

Link.propTypes = {
  // entityKey: PropTypes.string.isRequired,
  // contentState: PropTypes.object.isRequired,
};

export { onPasteLink, Link };
