from django.conf import settings
from django.utils.html import escape, format_html
from django.utils.module_loading import import_string
from draftjs_exporter.dom import DOM
from wagtail import VERSION as wagtail_version
from wagtail.admin.rich_text.converters.contentstate_models import Block
from wagtail.admin.rich_text.converters.html_to_contentstate import (
    BlockElementHandler,
    InlineEntityElementHandler,
    LinkElementHandler,
)

if wagtail_version >= (3, 0):
    from wagtail.models import Page
    from wagtail.rich_text import LinkHandler
    from wagtail.rich_text.pages import PageLinkHandler
    from wagtail.whitelist import check_url
else:
    from wagtail.core.models import Page
    from wagtail.core.rich_text import LinkHandler
    from wagtail.core.rich_text.pages import PageLinkHandler
    from wagtail.core.whitelist import check_url

# We can't use "anchor", as Wagtail uses this internally for links whose hrefs
# start with "#"
ANCHOR_TARGET_IDENTIFIER = "anchor-target"


def render_span(attrs):
    return format_html('<span id="{}">', attrs["id"])


def render_a(attrs):
    return format_html('<a href="#{id}" id="{id}" data-id="{id}">', id=attrs["id"])


def link_entity(props):
    """
    <a linktype="page" id="1" attrs>internal page link</a>
    """
    id_ = props.get("id")
    link_props = {}

    if id_ is not None:
        link_props["linktype"] = "page"
        link_props["id"] = id_
    else:
        link_props["href"] = check_url(props.get("url"))

    hash_ = props.get("hash")
    if hash_:
        link_props["hash"] = hash_

    return DOM.create_element("a", link_props, props["children"])


class PageHashedLinkHandler(PageLinkHandler):
    @classmethod
    def get_many(cls, attrs_list, custom=False):
        # Override LinkHandler.get_many to reduce database queries through the
        # use of PageQuerySet.specific() instead of QuerySet.in_bulk().
        instance_ids = [attrs.get("id") for attrs in attrs_list]
        qs = Page.objects.filter(id__in=instance_ids).defer_streamfields().specific()
        pages_by_str_id = {str(page.id): page for page in qs}

        pages_data = []
        for attr in attrs_list:
            page = pages_by_str_id.get(str(attr["id"]))
            if page:
                pages_data.append(
                    {"url": escape(page.localized.url), "hash": attr.get("hash")}
                )
        return pages_data

    @classmethod
    def build_a_tag(cls, page_data):
        try:
            url = page_data["url"]
            hash_ = page_data["hash"]
            if hash_:
                url = f"{url}#{hash_}"
            return f'<a href="{url}">'
        except Page.DoesNotExist:
            return "<a>"

    @classmethod
    def expand_db_attributes_many(cls, attrs_list):
        return [
            cls.build_a_tag(page_data)
            for page_data in cls.get_many(attrs_list, custom=True)
        ]

    # wagtail <6.0
    @classmethod
    def expand_db_attributes(cls, attrs):
        try:
            page = cls.get_instance(attrs)
            url = escape(page.localized.specific.url)
            hash_ = attrs.get("hash")
            if hash_:
                url = f"{url}#{hash_}"
            return '<a href="%s">' % url
        except Page.DoesNotExist:
            return "<a>"


class PageHashedLinkElementHandler(LinkElementHandler):
    def get_attribute_data(self, attrs):
        try:
            page = Page.objects.get(id=attrs["id"]).specific
        except Page.DoesNotExist:
            # retain ID so that it's still identified as a page link (albeit a broken one)
            return {
                "id": int(attrs["id"]),
                "url": None,
                "parentId": None,
                "hash": attrs.get("hash"),
            }

        parent_page = page.get_parent()
        return {
            "id": page.id,
            "url": page.url,
            "hash": attrs.get("hash"),
            "parentId": parent_page.id if parent_page else None,
        }


class AnchorIdentifierLinkHandler(LinkHandler):
    identifier = ANCHOR_TARGET_IDENTIFIER

    @classmethod
    def get_renderer(cls):
        renderer = getattr(cls, "_renderer", None)
        if renderer is None:
            renderer = getattr(settings, "DRAFTAIL_ANCHORS_RENDERER", render_a)
            if isinstance(renderer, str):
                renderer = import_string(renderer)
            cls._renderer = renderer
        return renderer

    @classmethod
    def expand_db_attributes(cls, attrs):
        renderer = cls.get_renderer()
        return renderer(attrs)


def anchor_identifier_entity_decorator(props):
    """
    Draft.js ContentState to database HTML.
    Converts the ANCHOR entities into <a> tags.
    """
    return DOM.create_element(
        "a",
        {
            "data-id": props["anchor"].lstrip("#"),
            "id": props["anchor"].lstrip("#"),
            "href": "#{}".format(props["anchor"].lstrip("#")),
            # Add a custom linktype so we can handle the DB -> HTML transformation
            "linktype": ANCHOR_TARGET_IDENTIFIER,
        },
        props["children"],
    )


class AnchorIndentifierEntityElementHandler(InlineEntityElementHandler):
    """
    Database HTML to Draft.js ContentState.
    Converts the <a> tags into ANCHOR IDENTIFIER entities, with the right data.
    """

    # In Draft.js entity terms, anchors identifier are "mutable".
    mutability = "MUTABLE"

    def get_attribute_data(self, attrs):
        """
        Take the ``anchor`` value from the ``href`` HTML attribute.
        """
        return {
            "anchor": attrs["href"].lstrip("#"),
            "data-id": attrs["id"],
        }


class AnchorBlockConverter:
    """
    Draft.js ContentState to database HTML.
    Converts the anchors in block data to html ids.
    """

    def __init__(self, tag):
        self.tag = tag

    def __call__(self, props):
        block_data = props["block"]["data"]

        elem_data = {
            "id": block_data.get("anchor") or block_data.get("id"),
        }

        if block_data.get("anchor"):
            elem_data["anchor"] = block_data.get("anchor")

        # Here, we want to display the block's content so we pass the `children` prop as the last parameter.
        return DOM.create_element(self.tag, elem_data, props["children"])


class DataBlock(Block):
    """
    ContentState block representation with block data
    """

    def __init__(self, *args, **kwargs):
        self.data = kwargs.pop("data")
        super().__init__(*args, **kwargs)

    def as_dict(self):
        return dict(data=self.data, **super().as_dict())


class AnchorBlockHandler(BlockElementHandler):
    """HTML to Draft.js ContentState for anchor blocks with a anchor"""

    def create_block(self, name, attrs, state, contentstate):
        return DataBlock(
            self.block_type,
            depth=state.list_depth,
            data={"id": attrs.get("id", ""), "anchor": attrs.get("anchor", "")},
        )
