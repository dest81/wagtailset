const React = window.React;
const RichUtils = window.DraftJS.RichUtils;
const Modifier = window.DraftJS.Modifier;
const SelectionState = window.DraftJS.SelectionState;
const TooltipEntity = window.draftail.TooltipEntity;
const Icon = window.wagtail.components.Icon;
const EditorState = window.DraftJS.EditorState;
const Portal = window.wagtail.components.Portal;
const Tooltip = window.draftail.Tooltip;
const LinkModalWorkflowSource = window.draftail.LinkModalWorkflowSource;

import slugify from "slugify";
// import PropTypes from "prop-types";

import { onPasteLink, Link } from "./wagtailset_draftail_links.js";

const DECORATORS = [];
const CONTROLS = [];
const DRAFT_PLUGINS = [];

const registerDecorator = (decorator) => {
  DECORATORS.push(decorator);
  return DECORATORS;
};

const registerControl = (control) => {
  CONTROLS.push(control);
  return CONTROLS;
};

const registerDraftPlugin = (plugin) => {
  DRAFT_PLUGINS.push(plugin);
  return DRAFT_PLUGINS;
};

// Override the existing initEditor to hook the new APIs into it.
// This works in Wagtail 2.0 but will definitely break in a future release.
const initEditor = window.draftail.initEditor;

const initEditorOverride = (selector, options, currentScript) => {
  const overrides = {
    decorators: DECORATORS.concat(options.decorators || []),
    controls: CONTROLS.concat(options.controls || []),
    plugins: DRAFT_PLUGINS.concat(options.plugins || []),
  };

  const newOptions = Object.assign({}, options, overrides);

  return initEditor(selector, newOptions, currentScript);
};

window.draftail.registerControl = registerControl;
window.draftail.registerDecorator = registerDecorator;
window.draftail.initEditor = initEditorOverride;

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

const CopyAnchorButton = ({ identifier }) => {
  const [didCopy, setDidCopy] = React.useState(false);

  const copyText = (event) => {
    // Prevent the button click event from submitting the page form
    event.preventDefault();
    navigator.clipboard.writeText(identifier);
    setDidCopy(true);
  };

  const classes = "button button-small";
  return (
    <button
      className={classes}
      style={{ marginLeft: "1rem" }}
      aria-label="Copy anchor identifier"
      aria-live="polite"
      role="button"
      onClick={copyText}
    >
      {didCopy ? "Copied" : "Copy"}
    </button>
  );
};

class HeaderAnchorDecorator extends TooltipEntity {
  constructor(props) {
    super(props);
  }
  getBlock(editorState) {
    const block_key = editorState.getSelection().getFocusKey();
    return this.props.contentState.getBlockForKey(block_key);
  }

  getData(editorState) {
    const block = this.getBlock(editorState);
    return block.getData();
  }

  setAnchor(anchor) {
    const editorState = this.props.getEditorState();
    let newEditorState = editorState;

    let newData = new Map();
    newData.set("anchor", anchor);

    let content = editorState.getCurrentContent();
    const selection = editorState.getSelection();
    content = Modifier.mergeBlockData(content, selection, newData);

    newEditorState = EditorState.push(editorState, content, editorState.getLastChangeType());
    newEditorState = EditorState.acceptSelection(newEditorState, selection);
    this.props.setEditorState(newEditorState);
  }

  onRemove(e) {
    e.preventDefault();
    e.stopPropagation();

    this.setAnchor(null);
  }

  onEdit(e) {
    e.preventDefault();
    e.stopPropagation();

    const editorState = this.props.getEditorState();
    const block = this.getBlock(editorState);

    const data = this.getData(editorState);
    const anchor = window.prompt(
      "Anchor Link:",
      data.get("anchor") || data.get("id") || slugify(block.getText().toLowerCase())
    );
    if (anchor) {
      this.setAnchor(slugify(anchor));
    }
  }

  render() {
    const children = this.props.children;

    const { showTooltipAt } = this.state;

    const editorState = this.props.getEditorState();
    const data = this.getData(editorState);
    const block = this.getBlock(editorState);
    // try to get custom anchor first, then id and only then build it from the text
    const anchor = data.get("anchor") || data.get("id") || slugify(block.getText().toLowerCase());
    const url = `#${anchor}`;

    // Contrary to what JSX A11Y says, this should be a button but it shouldn't be focusable.
    /* eslint-disable springload/jsx-a11y/interactive-supports-focus */
    return (
      <span
        role="button"
        // Use onMouseUp to preserve focus in the text even after clicking.
        onMouseUp={this.openTooltip}
        className="TooltipEntity"
        data-draftail-trigger
      >
        {children}
        <span style={{ paddingLeft: "0.5rem" }} className="icon icon-link"></span>
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
      </span>
    );
  }
}

function headingStrategy(contentBlock, callback, contentState) {
  if (contentBlock.getType().includes("header")) {
    callback(0, contentBlock.getLength());
  }
}

let previousContentState = null;
let previousUndoStackSize = 0;

registerDraftPlugin({
  decorators: [
    {
      strategy: headingStrategy,
      component: HeaderAnchorDecorator,
    },
  ],
  onChange: (editorState, PluginFunctions) => {
    // if content has been modified, update all heading blocks's data with
    // a slugified version of their contents as 'anchor', for use
    // in generating anchor links consistently with their displayed form

    // check if it is undo then return editorState without change
    const undoStack = editorState.getUndoStack();
    const undoSize = undoStack.size;
    if (undoSize < previousUndoStackSize) {
      return editorState;
    }
    previousUndoStackSize = undoSize;

    let content = editorState.getCurrentContent();

    // check if the content state has changed compared to the previous one
    if (previousContentState && content.equals(previousContentState)) {
      return editorState;
    }

    const blocks = content.getBlockMap();
    const selection = editorState.getSelection();
    let newEditorState = editorState;
    let contentChanged = false;

    for (let [key, block] of blocks.entries()) {
      if (block.getType().includes("header")) {
        const blockSelection = SelectionState.createEmpty(key);
        const data = block.getData();
        // do not change if there is a custom anchor
        if (data.get("anchor")) {
          continue;
        }
        let newId = slugify(block.getText().toLowerCase());
        if (data.get("id") != newId) {
          let newData = new Map();
          newData.set("id", newId);
          content = Modifier.mergeBlockData(content, blockSelection, newData);
          contentChanged = true;
        }
      }
    }
    if (contentChanged) {
      newEditorState = EditorState.push(editorState, content, editorState.getLastChangeType());
      newEditorState = EditorState.acceptSelection(newEditorState, selection);
    }
    previousContentState = newEditorState.getCurrentContent();
    return newEditorState;
  },
});

HeaderAnchorDecorator.propTypes = {
  // contentState: PropTypes.object.isRequired,
  // decoratedText: PropTypes.string.isRequired
};

window.draftail.registerPlugin({
  type: "LINK",
  source: LinkModalWorkflowSource,
  decorator: Link,
  onPaste: onPasteLink,
});
