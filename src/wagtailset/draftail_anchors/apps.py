from django.apps import AppConfig

from django.utils.translation import gettext_lazy as _


class WagtailDraftailAnchorsAppConfig(AppConfig):
    name = "wagtailset.draftail_anchors"
    label = "wagtailsetdraftailanchors"
    verbose_name = _("Wagtailset Draftail Anchors")
