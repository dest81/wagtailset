# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.1.7 - 2026-08-30

### Fixed

- minify js files

## 1.1.6 - 2026-08-30

### Fixed

- HeaderAnchorDecorator not working in StreamField RichTextBlock #9

### Updated

- renamed HeaderAnchorDecorator to EditableAnchorDecorator
- refactor decorator for compatibility with Wagtail 7.1+ #9
- simplify and improve the internal anchor auto-generation and manual override saving logic
- enhance editor UI by rendering heading blocks as links with anchor link icon in front

## 1.1.5 - 2026-08-09

### Fixed

- fix rich text link anchor data loss on image block insertion #7

## 1.1.4 - 2025-07-12

### Fixed

- update state only when it's necessary
- do not change state during undo

## 1.1.3 - 2025-03-31

### Fixed

- update PageHashedLinkHandler to work with wagtail > 6.0 #4

## [1.1.2] - 2024-09-29

### Fixed

- Anchor links not rendered in rich text editor #3
- Fix documentation

## [1.1.1] - 2023-09-10

### Fixed

- fix url in Link widget

## [1.1.0] - 2023-09-10

### Added

- add link icon to HeaderAnchorDecorator
- add CopyAnchorButton to AnchorIdentifier

### Fixed

- fix console error when promt cancelled

## [1.0.0] - 2023-08-20

### Added

- add anchored internal links

### Fixed

- fix CopyAnchorButton: class -> className
- extend HeaderAnchorDecorator from TooltipEntity
- slugify custom header anchor
- make all buttons in Tooltip small

## [0.0.1] - 2023-07-30

### Added

- init repo
- add wagtailset.draftail_anchors
