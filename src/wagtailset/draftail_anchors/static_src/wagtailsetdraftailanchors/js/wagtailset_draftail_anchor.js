const React = window.React;
const RichUtils = window.DraftJS.RichUtils;
const TooltipEntity = window.draftail.TooltipEntity;
const Icon = window.wagtail.components.Icon;
const EditorState = window.DraftJS.EditorState;
const Portal = window.wagtail.components.Portal;
const Tooltip = window.draftail.Tooltip;

import slugify from "slugify";

class AnchorIdentifierSource extends React.Component {
  componentDidMount() {
    const { editorState, entityType, onComplete, entity } = this.props;

    const content = editorState.getCurrentContent();

    let anchor_id = "";
    if (entity) {
      anchor_id = entity.data.anchor;
    }
    const anchor = window.prompt("Anchor identifier:", anchor_id);

    // Uses the Draft.js API to create a new entity with the right data.
    if (anchor) {
      const contentWithEntity = content.createEntity(entityType.type, "MUTABLE", {
        anchor: slugify(anchor.toLowerCase()),
      });
      const entityKey = contentWithEntity.getLastCreatedEntityKey();
      const selection = editorState.getSelection();
      const nextState = RichUtils.toggleLink(editorState, selection, entityKey);

      onComplete(nextState);
    } else {
      onComplete(editorState);
    }
  }

  render() {
    return null;
  }
}

class AnchorIdentifier extends TooltipEntity {
  render() {
    const { showTooltipAt } = this.state;
    const { entityKey, contentState, children } = this.props;
    const data = contentState.getEntity(entityKey).getData();
    const anchor = data.anchor || null;
    return (
      <a
        href=""
        role="button"
        onMouseUp={this.openTooltip}
        className="TooltipEntity"
        data-draftail-trigger
      >
        <Icon name="anchor" className="TooltipEntity__icon" />
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
              <span className="Tooltip__link">{anchor}</span>
              <CopyAnchorButton identifier={anchor} />
              <button className="button button-small Tooltip__button" onClick={this.onEdit}>
                Edit
              </button>

              <button
                className="button button-small button-secondary no Tooltip__button"
                onClick={this.onRemove}
              >
                Reset
              </button>
            </Tooltip>
          </Portal>
        )}
      </a>
    );
  }
}

window.draftail.registerPlugin({
  type: "ANCHOR-IDENTIFIER",
  source: AnchorIdentifierSource,
  decorator: AnchorIdentifier,
});

class CopyAnchorButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = { didCopy: false };
    this.copyText = this.copyText.bind(this);
  }

  copyText(event) {
    // prevent button click event from submitting the page form
    event.preventDefault();
    navigator.clipboard.writeText(this.props.identifier);
    this.setState({ didCopy: true });
    setTimeout(() => {
      this.setState({ didCopy: false });
    }, 2000);
  }

  render() {
    const { didCopy } = this.state;
    const classes = "button button-small";

    return (
      <button
        className={classes}
        style={{ marginLeft: "1rem" }}
        aria-label="Copy anchor identifier"
        aria-live="polite"
        type="button"
        onClick={this.copyText}
      >
        {didCopy ? "Copied" : "Copy"}
      </button>
    );
  }
}

const anchorifyHeading = (content, blockKey, anchor, manual = false) => {
  const blockMap = content.getBlockMap();
  // Use low-level APIs so we avoid adding to the undo/redo stack
  // or changing the selection.
  const blocks = blockMap.map((b) => {
    if (b.getKey() === blockKey) {
      const newData = new Map();
      if (manual) {
        newData.set("manual", true);
      } else {
        newData.set("manual", false);
      }
      newData.set("id", anchor);
      console.log(anchor, newData);
      return b.set("data", b.getData().merge(newData));
    }
    return b;
  });
  return content.merge({
    blockMap: blockMap.merge(blocks),
  });
};

class EditableAnchorDecorator extends TooltipEntity {
  constructor(props) {
    super(props);
  }

  getBlock() {
    const blockKey = this.props.offsetKey.split("-")[0];
    return this.props.contentState.getBlockForKey(blockKey);
  }

  getData() {
    const editorState = this.props.getEditorState();
    const block = this.getBlock();
    return block.getData(editorState);
  }

  getAnchor() {
    const data = this.getData();
    // try to get custom anchor first, then id and only then generate it from the text
    // return data.get("anchor") || data.get("id") || slugify(block.getText().toLowerCase());
    return data.get("anchor") || data.get("id") || slugify(this.props.decoratedText);
  }

  setData(anchor, manual = false) {
    const blockKey = this.props.offsetKey.split("-")[0];
    let content = this.props.contentState;
    let editorState = this.props.getEditorState();
    content = anchorifyHeading(content, blockKey, anchor, manual);
    editorState = EditorState.set(editorState, { currentContent: content });
    this.props.setEditorState(editorState);
  }

  setAnchorData(text = null, reset = false) {
    const block = this.getBlock();
    const manual = block.getData().get("manual", false) || text !== null;
    const currentAnchor = block.getData().get("id");

    const newText = text || this.props.decoratedText;
    const newAnchor = slugify(newText.toLowerCase());

    if (reset) {
      this.setData(newAnchor);
      return;
    }

    if (currentAnchor !== newAnchor) {
      if (manual && text) {
        this.setData(newAnchor, true);
      } else if (!manual) {
        this.setData(newAnchor);
      }
    }
    return;
  }

  componentDidMount() {
    this.setAnchorData();
  }

  componentDidUpdate() {
    // Conditional newAnchor update if the text has changed.
    this.setAnchorData();
  }

  onRemove(e) {
    e.preventDefault();
    e.stopPropagation();

    this.setAnchorData(null, true);
  }

  onEdit(e) {
    e.preventDefault();
    e.stopPropagation();

    const anchor = this.getAnchor();
    const newAnchor = window.prompt("Anchor Link:", anchor);
    if (newAnchor) {
      this.setAnchorData(slugify(newAnchor));
    }
  }

  render() {
    const children = this.props.children;

    const { showTooltipAt } = this.state;

    const anchor = this.getAnchor();
    const url = `#${anchor}`;

    // Contrary to what JSX A11Y says, this should be a button but it shouldn't be focusable.
    /* eslint-disable springload/jsx-a11y/interactive-supports-focus */
    return (
      <a
        href=""
        role="button"
        // Use onMouseUp to preserve focus in the text even after clicking.
        onMouseUp={this.openTooltip}
        className="TooltipEntity"
        data-draftail-trigger
      >
        <Icon name="link" className="TooltipEntity__icon" />
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
              <span className="Tooltip__link">{url}</span>
              <CopyAnchorButton identifier={anchor} />
              <button className="button button-small Tooltip__button" onClick={this.onEdit}>
                Edit
              </button>

              <button
                className="button button-small button-secondary no Tooltip__button"
                onClick={this.onRemove}
              >
                Reset
              </button>
            </Tooltip>
          </Portal>
        )}
      </a>
    );
  }
}

function headingStrategy(contentBlock, callback, contentState) {
  // Decorates all headings as a mechanism to convert them to anchors.
  if (contentBlock.getType().includes("header")) {
    callback(0, contentBlock.getLength());
  }
}

window.draftail.registerPlugin(
  {
    type: "ANCHOR-IDENTIFIER",
    strategy: headingStrategy,
    component: EditableAnchorDecorator,
  },
  "decorators"
);
