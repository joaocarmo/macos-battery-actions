#!/usr/bin/env node
const { promisify } = require('util')
const exec = promisify(require('child_process').exec)

// Settings
FIRST_THRESHOLD = 0.5
SECOND_THRESHOLD = 0.4

const getSystemProfile = async () => {
  const shellCommand = 'system_profiler SPPowerDataType | grep -A3 "Charge Remaining"'
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

const sendAlert = () => console.log('Alert!')

const hibernate = () => console.log('Hibernate!')

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
