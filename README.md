# @ayhungyry/translations

Find missing messages from translation files and generates them them using ChatGPT

## Installation

Add this line to your `.npmrc` file:

`@ayhungry:registry=https://npm.pkg.github.com`

then

`npm install -D @ayhungry/translations`

You will need an openAI API Key

## Usage

Add a translations script to your package.json

```
"scripts": {
  "translations": "translations",
},
```

Then run: `npm run translations`

### Available options

| flag  | description  | default value  |
|---|---|---|
| --openAiKey  |  Your [openAI](https://openai.com/) API Key |   |
| --referenceLanguage  | Language to be used as reference (Must contain all the messages you need)  | es  |
|  --messagesPath | Path to json files with messages  | ./messages  |
|  --overrideLocales | Specific country locales to be used  | [] |

Example:

`npm run translations --referenceLanguage=en --overrideLocales=es-CL,pt-BR --openAiKey=sk-oD54ThvsgFgds --messagesPath=../../intl`

You can alternatively set yout openAI API Key as an `OPENAI_API_KEY` env variable
