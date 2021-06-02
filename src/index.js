#!/usr/bin/env node
const { promisify } = require('util')
const exec = promisify(require('child_process').exec)

// Settings
const FIRST_THRESHOLD = 0.5
const SECOND_THRESHOLD = 0.4
const ALERT_TITLE = 'Battery Status'
const ALERT_MESSAGE = 'Please consider pluggin in to power!'
const DIALOG_MESSAGE = 'Your battery is at a critical level! Sleep?'
const DIALOG_NO = 'No'
const DIALOG_YES = 'Yes'
const SYSTEM_PROFILER = '/usr/sbin/system_profiler'
const OSASCRIPT = '/usr/bin/osascript'
const PMSET = '/usr/bin/pmset'

const getSystemProfile = async () => {
  const shellCommand =
    `${SYSTEM_PROFILER} SPPowerDataType | grep -A3 "Charge Remaining"`
  const { stdout } = await exec(shellCommand)
  return stdout
}

const cleanTokens = (token) => token.trim()

const removeEmpty = (token) => !!token

const toCamelCase = (string) =>
  `${string.charAt(0).toLowerCase()}${string.slice(1)}`

const formatKey = (key) => toCamelCase(
  key.replaceAll(' ', '').match(/([A-Za-z]+)/)[0]
)

const formatValue = (value) => {
  if (!Number.isNaN(+value)) {
    return +value
  }

  if (value.toLowerCase() === 'yes') {
    return true
  }

  if (value.toLowerCase() === 'no') {
    return false
  }

  return value
}

const formatTokens = ([key, value]) => [formatKey(key), formatValue(value)]

const toKeyValue = (token) => token.split(':').map(cleanTokens)

const parseOutput = (inputStr) => {
  if (!inputStr || typeof inputStr !== 'string') {
    return {}
  }

  const tokens = inputStr
    .split('\n')
    .map(cleanTokens)
    .filter(removeEmpty)
    .map(toKeyValue)
    .map(formatTokens)

  const parsed = Object.fromEntries(tokens)

  return parsed
}

const sendAlert = async (message = ALERT_MESSAGE, title = ALERT_TITLE) => {
  const shellCommand =
    `${OSASCRIPT} -e 'display notification "${message}" with title "${title}"'`
    await exec(shellCommand)
}

const macDialog = async (message = DIALOG_MESSAGE) => {
  const appleScript = `\
display alert "${message}" buttons {"${DIALOG_NO}", "${DIALOG_YES}"}
if button returned of result = "${DIALOG_NO}" then
    return "${DIALOG_NO}"
else
    if button returned of result = "${DIALOG_YES}" then
        return "${DIALOG_YES}"
    end if
end if
`
  const shellCommand = `${OSASCRIPT} -e '${appleScript}'`
  const { stdout } = await exec(shellCommand)
  const result = stdout.trim()

  if (result === DIALOG_NO) {
    throw new Error('User cancelled action.')
  }
}

const hibernate = async () => {
  try {
    const shellCommand = `${PMSET} sleepnow`

    await macDialog()
    await exec(shellCommand)
  } catch (err) {
    console.log(err.message)
  }
}

const main = async () => {
  const systemProfileStr = await getSystemProfile()
  const {
    chargeRemaining,
    charging,
    fullChargeCapacity,
    fullyCharged,
  } = parseOutput(systemProfileStr)

  if (!fullyCharged && !charging) {
    const percentage = chargeRemaining / fullChargeCapacity
    const percentageStr = (percentage * 100).toFixed(1)

    console.log(`Current percentage: ${percentageStr}%`)

    if (percentage < SECOND_THRESHOLD) {
      console.log(`Second threshold reached (${SECOND_THRESHOLD}).`)

      return hibernate()
    }

    if (percentage < FIRST_THRESHOLD) {
      console.log(`First threshold reached (${FIRST_THRESHOLD}).`)

      return sendAlert()
    }
  }

  console.log('All good!')
}

if (require.main === module) {
  main()
}
