#!/usr/bin/env node

import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import flags from 'flags'
import { flatten } from 'flat'
import loadingSpinner from 'loading-spinner'
import chalk from 'chalk'
import yesno from 'yesno'
import OpenAI from 'openai';
import lodash from 'lodash'

flags.defineString('openAiKey', '', 'Your OpenAI API key');
flags.defineString('referenceLanguage', 'es', 'Language to be used as reference (should contain all the messages you need)');
flags.defineStringList('overrideLocales', [], 'Define specific country locales, example --overrideLocales=es-ES,pt-BR');
flags.defineString('messagesPath', './messages', 'Path to your messages files');
flags.parse();

/**
 * @typedef {Object} Language
 * @property {string} name
 * @property {number} path
 * @property {any} messages
 */

/**
 * @typedef {Object} MissingMessage
 * @property {string} language
 * @property {string} key
 * @property {string} referenceLanguage
 * @property {string} referenceMessage
 */

/**
 * @typedef {Object} Translation
 * @property {string} language
 * @property {string} key
 * @property {string} message
 */

const referenceLanguageKey = flags.get('referenceLanguage')
/*
 * @type {Language[]}  
 */
let languages = []

/*
 * @param {string} locale
 * @returns {string}
 */ 
function overrideLocale(locale) {
  if(flags.get('overrideLocales')) {
    const overrideLocales = flags.get('overrideLocales')
    const overrideLocale = overrideLocales.find((overrideLocale) => overrideLocale.split('-')[0] === locale)
    if (overrideLocale) {
      return overrideLocale
    }
  }
  return locale
}

/*
 * @returns {Language[]}
 */

async function getLanguages() {
  const messagesPath = flags.get('messagesPath')
  const results = fs.readdirSync(messagesPath)
  const jsonFiles = results.filter((fileName) => fileName.endsWith('.json'))
  return jsonFiles.map((fileName) => ({
    name:  fileName.replace('.json', ''),
    path: `${messagesPath}/${fileName}`,
    messages: JSON.parse(fs.readFileSync(`${messagesPath}/${fileName}`, 'utf8'))
  }))
}

/*
 * @param {MissingMessage[]} missingMessages
 * @returns {Translation[]}
 */
async function autoTranslate (missingMessages) { // MissingMessage[]
  console.log('Translating...')
  
  if (!flags.get('openAiKey') && !process.env.OPENAI_API_KEY) {
    console.log(chalk.red('Missing openAI API key'))
    return []
  }

  const openai = new OpenAI({
    apiKey: flags.get('openAiKey') || process.env.OPENAI_API_KEY,
  })

  loadingSpinner.start()

  let translations = []

  for (const message of missingMessages) {
    const response = await openai.chat.completions.create({
      messages: [{
        role: 'user',
        content: `Translate ${message.referenceMessage} from ${message.referenceLanguage} to ${overrideLocale(message.language)}`
      }],
      model: 'gpt-4',
    });
    translations.push({
      language: message.language,
      key: message.key, 
      message: response.choices[0].message.content, 
    });
  }
  loadingSpinner.stop()
  console.log('Translations done ✅\n')

  return translations
}

/*
  * @param {Translation[]} translations
  */
async function updateLanguageFiles(translations) {
  console.log('Patching language files...')
  for (const translation of translations) {
    const language = languages.find((language) => language.name === translation.language)
    if (language) {
      lodash.set(language.messages, translation.key, translation.message)
    }
  }

  const translationLanguages = translations.map((translation) => translation.language)
  const affectedLanguages = languages.filter((language) => (
    translationLanguages.includes(language.name)
  ))
  for (const language of affectedLanguages) {
    fs.writeFileSync(language.path, JSON.stringify(language.messages, null, 2))
    fs.appendFileSync(language.path, os.EOL)
  }
  console.log('Done ✅')
}

/*
  * @returns {Promise<void>}
  */
async function checkTranslations () {
  languages = await getLanguages()

  const referenceLanguage = languages.find((language) => language.name === referenceLanguageKey)
  if (!referenceLanguage) {
    throw `Reference language '${referenceLanguage}' not found`
  }

  console.log(`${languages.length} languages found: ${languages.map((language) => language.name).join(', ')}`)
  console.log(`Using: '${referenceLanguage.name}' as reference`)
  let translationsOk = true
  /*
   * @type {MissingMessage[]}
   */
  let missingMessages = []
  const flatReferenceMessages = flatten(referenceLanguage.messages)
  for (const language of languages) {
    if (language.name !== referenceLanguage.name) {
      const newMissingMessages = Object.keys(flatReferenceMessages).filter((key) => (
        !Object.keys(flatten(language.messages)).includes(key)
      )).map((key) => ({
        language: language.name,
        key,
        referenceLanguage: referenceLanguage.name,
        referenceMessage: lodash.get(referenceLanguage.messages, key),
      }))
      if (newMissingMessages.length > 0) {
        console.log(chalk.red(`Missing messages in '${language.name}'`))
        console.log(newMissingMessages.map(message => message.key))
        translationsOk = false
      }
      missingMessages = missingMessages.concat(newMissingMessages)
    }
  }
  if (translationsOk) {
    console.log(chalk.green('Translations are ok 👌'))
  } else {
    const shouldTranslate = await yesno({
      question: '\nTranslate missing messages with chatGPT? (y/N)',
      defaultValue: false,
    })
    /*
     * @type {Translation[]}
     */
    let translations = []
    if (shouldTranslate) {
      translations = await autoTranslate(missingMessages)
    }
    if (translations?.length > 0) {
      for (const translation of translations) {
        console.log(`[${chalk.green(overrideLocale(translation.language))}] ${chalk.cyan(translation.key)} => ${translation.message}`)
      }

      const shouldPatch = await yesno({
        question: '\nPatch language files? (y/N)',
        defaultValue: false,
      })
      if (shouldPatch) {
        updateLanguageFiles(translations)
      }
    }
  }

}

checkTranslations();
