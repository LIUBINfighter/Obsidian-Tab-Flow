# Obsidian Tab Flow

Play and create your guitar tabs in Obsidian with interactive features!

## Features

🎵 **Interactive Guitar Tab Player**
- Play and create guitar tabs using [AlphaTab.js](https://alphatab.net) engine
- Support multiple formats: `.alphatab`, `.gp`, `.gp3`, `.gp4`, `.gp5`, `.gpx`
- Modern music font and high-quality sound synthesis

🎼 **Markdown Integration**
- Render AlphaTex code blocks directly in Markdown
- Real-time preview and editing
- Syntax highlighting and error reporting
- Seamless integration with Obsidian's workflow

🎛️ **Advanced Playback Controls**
- Play/Pause, Stop, and track navigation
- Interactive progress bar with seeking
- Auto-scroll during playback with customizable speed
- Metronome and count-in functionality
- Speed adjustment and tempo control
- Zoom and layout switching (page/horizontal scroll)

🎯 **Track Management**
- Multi-track support with individual controls
- Solo/mute tracks independently
- Volume control per track
- Global and per-track transposition
- Track selection modal

📤 **Export Capabilities**
- Export as audio (WAV format)
- Export as MIDI files
- Export as Guitar Pro files
- Print to PDF
- Custom file naming

🎨 **Theme Integration**
- Full dark/light mode support
- Adapts to Obsidian's CSS variables
- Customizable interface components
- Responsive design for different screen sizes

⚙️ **Customizable Interface**
- Configurable playbar components
- Show/hide individual controls
- Reorderable control layout
- Debug tools for developers

🌐 **Internationalization**
- Multi-language support (English/Chinese)
- Extensible translation system

## Installation

1. Install from Obsidian Community Plugins (coming soon)
2. Or manually download from releases and extract to `.obsidian/plugins/tab-flow/`
3. Enable the plugin in Obsidian settings
4. Download required assets (fonts, soundfonts) when prompted

## Usage

### Basic Tab Playing
1. Open any supported guitar tab file (`.gp`, `.gp5`, etc.)
2. The interactive player will automatically load
3. Use playback controls to play, pause, and navigate

### AlphaTex in Markdown
Create AlphaTex code blocks in your Markdown files:

```alphatex
\\title "My Song"
\\tempo 120

1.2 3.1 | 4.2 2.3 | 
```

### Advanced Features
- Access settings via the settings button in the playbar
- Use the track selector to manage multi-track files
- Export your tabs using the export menu
- Customize the interface in plugin settings

## Roadmap

### ✅ Completed Features
- Core tab rendering and playback
- AlphaTex markdown integration
- Export system (Audio, MIDI, GP, PDF)
- Theme adaptation and dark mode
- Multi-language support
- Customizable playbar
- Auto-scroll functionality

### 🚧 In Development
- Advanced AlphaTex editor with syntax highlighting
- Visual WYSIWYG editor
- Template system and auto-completion
- Enhanced mobile support

### 🔮 Future Plans
- OCR support for converting sheet music
- Community features and tab sharing
- Advanced audio effects and processing
- Integration with external music services
- Plugin API for extensions

View more detailed planning at [our testing website](https://liubinfighter.github.io/alphatab-vue/) and [development repository](https://github.com/LIUBINfighter/alphatab-vue).

## Contributing

Thanks for downloading this plugin and we appreciate your contributions!

### Reporting Issues
- Use our [Issue Templates](.github/ISSUE_TEMPLATE/) for bug reports and feature requests
- Check existing issues before creating new ones
- Provide detailed information and steps to reproduce bugs

### Contributing Code
- Use our [Pull Request Template](.github/pull_request_template.md)
- Follow the existing code style and conventions
- Add tests for new features when applicable
- Update documentation as needed

### Development Setup
```bash
# Install dependencies
npm install

# Development build with auto-reload
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

<!-- If you want to add a new language to obsidian-tab-flow, see this guide first. -->

## Inspired by ...

[AlphaTab.js](https://alphatab.net)

Bocchi the rock!

Girls' Band Cry

## Disclaimer

Please make a backup for your gp files. Some tabs rendered with bad results because of the different encoding methods for Chinese/Japanese/... characters.

This plugin can't automatically download `font`, `soundfont` and `worker.mjs` for you due to obsidian's policy about community plugins. However, we provide a bottom to complete the settings.

<!-- This plugin doesn't have official relationships with AlphaTab.js and Obsidian Official Team. -->

## Copyright & Credit

Copyright (c) 2025 Jay Bridge and other contributors. All rights reserved.

Licensed under the MPL 2.0 License.

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/LIUBINfighter/obsidian-tab-flow)

<!-- ## Packages Using -->

<!-- AlphaTab.js -->

<!-- ## Develop Env -->

<!-- VSCode -->
