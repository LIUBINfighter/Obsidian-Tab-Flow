[![CI](https://github.com/LIUBINfighter/Obsidian-Tab-Flow/actions/workflows/ci.yml/badge.svg)](https://github.com/LIUBINfighter/Obsidian-Tab-Flow/actions/workflows/ci.yml)

# Obsidian Tab Flow

Play and create your guitar tabs in Obsidian!

## Feature

### Customed Play experience

![visual-editor-playbar](https://github.com/user-attachments/assets/4fce8ba1-31fa-4ca5-ab78-d721374ce975)


### Write Guitar Tabs like Markdown

`.alphatab`

<img width="2560" height="1504" alt="image" src="https://github.com/user-attachments/assets/e3a86a1a-3a85-469f-aa07-bda97faaf891" />

`alphaTex` codeblock in `.md`

![alphatex-copy-and-paste-writing](https://github.com/user-attachments/assets/ef402b18-9c3f-4e10-8772-a3fd8e50c507)

<!--![alphatex-copy-and-paste-writing-multiview](https://github.com/user-attachments/assets/30d1e922-d4d2-4edd-a68a-8b2f3bada705)-->


### Share your riff (Beta)

<img width="2560" height="1504" alt="image" src="https://github.com/user-attachments/assets/2f784059-4fef-4345-a6e4-d543ea7b2169" />


### Learn alphaTex in built-in interactive playground

<img width="2560" height="1504" alt="image" src="https://github.com/user-attachments/assets/df7ba557-2c15-4db8-bfdf-d011e5362a16" />

Enter the document view by command or click the robbin icon `guitar`.

![alphatex-and-doc](https://github.com/user-attachments/assets/92821b4a-739c-458b-a1f3-1df0d64421ef)


## Install & Enable Play Font

### 1 install by bart42 (recommended, provide detailed version control & beta access)

1. Install Brat plugin (if not yet)
- search for BRAT
- Install & enable BRAT
2. Add Tab Flow plugin
- Jump to Option
- Add beta plugin
```
https://github.com/LIUBINfighter/Obsidian-Tab-Flow
```
- Select version & Add plugin
3. Download missing assets
- Open Tab Flow settingTab
- Downding missing asset files
- Reload Tab Flow plugin or Obsidian app

<img width="2560" height="1504" alt="image" src="https://github.com/user-attachments/assets/2a0052a2-d0a0-4d76-86ea-731d49d1902a" />
<img width="2560" height="1504" alt="image" src="https://github.com/user-attachments/assets/80d9a66c-2d29-4c12-b5b7-76f4fca243d6" />
<!-- <img width="2560" height="1504" alt="image" src="https://github.com/user-attachments/assets/6f89ad16-5206-4119-a42c-b5d35a19aa37" /> -->
<img width="2560" height="1504" alt="image" src="https://github.com/user-attachments/assets/6a4bc746-f292-4076-be1f-7c43192ba774" />
<!-- <img width="2560" height="1504" alt="image" src="https://github.com/user-attachments/assets/76a27078-f711-4f35-a9d2-23bae403ad56" /> -->
![download-assets](https://github.com/user-attachments/assets/b3ca9620-83df-4517-a005-fd0a3acba0c9)


For Security reason, obsidian community plugin can't request from web automatically to prevent potential malicious attack, so it's neccesarry for you to do manually comfirm. 

If you do concern about the assets loading, please refer to this Chapter Security and package using
(Draft)
Tab Flow plugin uses a npm package @coderline/alphatab [github repo](https://github.com/CoderLine/alphaTab), the package content (font & sound font) is from .....

Currently Tab Flow plugin downloads assets fromm github release(frozen and immutable release/tag, 0.0.5 for now). If you do concern about the code, please refer to the latest tag & code file (to add)
(Draft)


### 2 download by github release & manual install

<!-- <img width="1946" height="1278" alt="image" src="https://github.com/user-attachments/assets/685965d9-9718-480d-adac-171f00f3c65c" /> -->
<img width="1946" height="1278" alt="image" src="https://github.com/user-attachments/assets/f6798b91-73d7-4543-8c28-61af013a7e0d" />

Release `tab-flow.zip` contains assets in right dictory position, so there is no need to download assets and reload again.

### 3 Obsidian Community Plugin Market (Currently Unable review queue)

Search `Tab Flow` and enable it.

## RoadMap



---


# Obsidian Tab Flow Readme (outdated)

Play and create your guitar tabs in Obsidian!

<!-- GIF NEEDED -->


![alphatex-and-doc](https://github.com/user-attachments/assets/92821b4a-739c-458b-a1f3-1df0d64421ef)

![alphatex-copy-and-paste-writing](https://github.com/user-attachments/assets/ef402b18-9c3f-4e10-8772-a3fd8e50c507)

![alphatex-copy-and-paste-writing-multiview](https://github.com/user-attachments/assets/30d1e922-d4d2-4edd-a68a-8b2f3bada705)

![download-assets](https://github.com/user-attachments/assets/b3ca9620-83df-4517-a005-fd0a3acba0c9)

![visual-editor-playbar](https://github.com/user-attachments/assets/4fce8ba1-31fa-4ca5-ab78-d721374ce975)


## Features

Play and Create guitar tabs using AlphaTab. Modern music font and sound! (Support .alphatab, .gp, .gp3, .gp4, .gp5, .gpx).

## Roadmap

### Beta Testing

- Render tabs
- PlayPause
- Stop
- cursor

### WIP

- Darkmode
- auto-scroll

### Plan

- i18n adaptation
- Stylesheet
  - Obsidian css var adaptation
- Control components
  - save settings
  - Layout
  - Zoom
  - Speed
  - CountIn
  - Metronome
- alphatex editor
  - Highlight syntax
  - gp export
- pdf
- png
- View more planning feature at [my testing website](https://liubinfighter.github.io/alphatab-vue/) and [its repo](https://github.com/LIUBINfighter/alphatab-vue)

### Future Ideas

- in-markdown render
- display
  - record video and sound
- alphatex
  - ocr by fine-tune vlms
  - template
  - auto complete
  - dashboard
  - share
  - community
- visual editor (WYSIWYG)
- ...
- and FRs from you!

## Contributing

Thanks for downloading this plugin and I appreciate it if you can help contribute!

If you have any feature requests / bugs to report, feel free to have an issue.

If you have done something brilliant, then go for a pull request.

<!-- If you want to add a new language to obsidian-tab-flow, see this guide first. -->

<!-- ## How to Build -->

<!-- ## Star History -->

<!-- Star History Chart -->

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
