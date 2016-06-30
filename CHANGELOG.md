### 1.4.0

- Added change log
- Use icons for var types in debugger
- Highlight debugger vars
- Do not use custom font family and size in debugger
- Fixed quick open for windows users
- Callback stack panel renamed to scripts

### 1.4.1

- fixed "open script" for windows users
- disable debugger buttons when inactive
- fixed twipsy autohide
- added show settings to main menu
- better var color for dark theme

### 1.4.2

- fixed set breakpoints

### 1.4.3

- fixed after and before cases when test failed

### 1.4.4

- clear debugger if restart and clear mocha treeview if tests restart at watch

### 1.4.5

- fixed show diff link when click to test case
- change mocha summary output
- added popup for mocha summary if panel hidded
- fixed skip test in mocha view

### 1.4.6

- fixed save run configs issue in settings view
- fixed issue with empty setting flags
- fixed if procees fails, don't show it as running or put the buttons in a locked state.
- fixed wait background when test runing


### 1.5.0

- added npm scripts support
- added gulp tasks support
- improved runner selector
- added double click for mocha test cases - opens test and moves cursor to the test case
- fixed empty flags issue for old settings
- fixed total tests count in mocha summary

### 1.5.1

- disabled debug mode for gulp runner

### 1.5.2

- force colors in gulp output
- fixed script and flags order for gulp and npm

### 1.5.3

- fixed icon size if runner name is long

### 1.6.0

- added 'start current nodejs file' and 'start current mocha file' features
- added queue_manager to resolve "console log spam" issue
- cleanup scrollbars for better view under Windows and Linux
- fixed icon size if runner name is long
- fixed scripts selector view

### 1.7.0

- removed local mocha package (global installation is required)
- added de and ru localization
- added live search for runner selector
- added keyboard more shortcuts (open new tab, close tab...)
- added debugger_break_on_start option (default true)
- added 'create_new_tab_when_panel_opened_and_empty' and 'change_runner_when_new_tab_opened' options (default true)

### 1.7.1

- fixed font size for console (now font size is related to brackets global settings)
- added 'start nodejs project' feature
- fixed Mustache require for Brackets 1.7.0

### 1.7.2

- added side-by-side difference view for mocha


### 1.8.0

- added code hint for require feature
- fixed side by side modal view

### 1.8.1

- fixed font size and family in debugger
- fixed require hints match
- fixed runner selector list scrolling
- fixed font for diff links in console output

### 1.8.2

- show packages hints only if no relative path specified
- added nodejs built-in libs ti require hints

### 1.8.3

- use CodeMirror as diff tool for mocha expectations

### 1.8.4

- use thirdparty CodeMirror libs

### 1.8.5

- added node_modules installer
- replaced treekill package to tree-kill

### 1.8.6

- use global npm binary setting for installer

### 1.8.7

- fixed debugger locals font and view
- fixed locals duplicates in debugger
- fixed strict function declaration at extension load