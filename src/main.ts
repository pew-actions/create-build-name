import * as fs from 'fs'
import * as os from 'os'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as wordlist from './wordlist'

const repositoryPath = core.getInput('repository-path') || '.'

class GitOutput {
  stdout = ''
  exitCode = 0
}

async function execGit(args: string[], silent = true) : Promise<GitOutput> {
  const result = new GitOutput()

  const env = {}
  for (const key of Object.keys(process.env)) {
    env[key] = process.env[key]
  }
  env['TZ'] = 'UTC0'

  const stdout: string[] = []

  const options = {
    env,
    silent,
    cwd: repositoryPath,
    listeners: {
      stdout: (data: Buffer) => {
        stdout.push(data.toString())
      },
    }
  }

  const gitPath = await io.which('git', true)

  result.exitCode = await exec.exec(`"${gitPath}"`, args, options)
  result.stdout = stdout.join('')
  return result
}

async function getGitDate() : Promise<Date> {
    const args : string[] = [
      'log',
      '-1',
      '--date=unix',
      '--pretty=%ad',
    ]

    const result = await execGit(args)

    const unixTimestamp = parseInt(result.stdout.trim())
    console.log(`Git date: ${unixTimestamp}`)
    return new Date(1000 * unixTimestamp)
}

function parseCustomDate() : Date|undefined {
  const raw = core.getInput('date')
  if (!raw) {
    return undefined
  }

  // Need to have a double ZZ prefix to keep GitHub from interpolating the data
  if (!raw.endsWith('ZZ')) {
    throw new Error("Custom date input MUST end with ZZ to prevent GitHub from interpolating time zones")
  }

  return new Date(raw.substring(0, raw.length - 1))
}

async function run() : Promise<void> {

  try {

    // get project name
    const repositoryOwner = process.env.GITHUB_REPOSITORY_OWNER!.toLowerCase()
    const qualifiedRepositoryName = process.env.GITHUB_REPOSITORY!.toLowerCase()
    const repositoryName = qualifiedRepositoryName.replace(repositoryOwner + '/', '')
    const projectName = core.getInput('project-name').toLowerCase() || repositoryName

    const buildConfiguration = core.getInput('build-configuration')
    const branch = (core.getInput('branch-name') || process.env.GITHUB_REF_NAME!).toLowerCase()

    var templateName = core.getInput('format')

    const logDate = parseCustomDate() ?? await getGitDate()
    const logDateYear = (logDate.getUTCFullYear() % 100).toString().padStart(2, '0')
    const logDateMonth = (logDate.getUTCMonth() + 1).toString().padStart(2, '0')
    const logDateDate = logDate.getUTCDate().toString().padStart(2, '0')
    const logDateHour = logDate.getUTCHours().toString().padStart(2, '0')
    const logDateMinute = logDate.getUTCMinutes().toString().padStart(2, '0')
    const logDateSecond = logDate.getUTCSeconds().toString().padStart(2, '0')

    const longDate = `${logDateYear}${logDateMonth}${logDateDate}-${logDateHour}${logDateMinute}${logDateSecond}`
    const shortDate = `${logDateMonth}${logDateDate}`

    var gitHash = core.getInput('ref')
    if (gitHash) {
      gitHash = gitHash.substr(0, 7).toLowerCase()
    } else {
      const args : string[] = [
        'log',
        '-1',
        '--pretty=%h',
      ]

      const result = await execGit(args)
       gitHash = result.stdout.trim()
    }

    templateName = templateName.replace('{hash}', gitHash)

    const runNumber = process.env.GITHUB_RUN_NUMBER
    const numberedBranchName = `${branch}${runNumber}`

    templateName = templateName.replace('{datetime}', longDate)
    templateName = templateName.replace('{project}', projectName).replace('{branch}', numberedBranchName)

    const shortName = shortDate + wordlist.generateAdjectiveNoun(templateName)
    core.setOutput('short', shortName)
    console.log(`Using template name ${templateName} with short name ${shortName}`)

    templateName = templateName.replace('{shortname}', shortName)
    if (buildConfiguration) {
      templateName = templateName.replace('{configuration}', buildConfiguration.toUpperCase())
    }

    core.setOutput('template', templateName)
    core.setOutput('nx', templateName.replace('{platform}', 'NX'))
    core.setOutput('pc', templateName.replace('{platform}', 'PC'))
    core.setOutput('ps4', templateName.replace('{platform}', 'PS4'))
    core.setOutput('ps5', templateName.replace('{platform}', 'PS5'))
    core.setOutput('xb1', templateName.replace('{platform}', 'XB1'))
    core.setOutput('xbs', templateName.replace('{platform}', 'XBS'))

  } catch (err: any) {
    if (err instanceof Error) {
      const error = err as Error
      core.setFailed(err.message)
    } else {
      throw err
    }
  }
}

run()
