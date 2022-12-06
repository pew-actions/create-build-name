import * as fs from 'fs'
import * as os from 'os'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as io from '@actions/io'

class GitOutput {
  stdout = ''
  exitCode = 0
}

async function execGit(args: string[]) : Promise<GitOutput> {
  const result = new GitOutput()

  const env = {}
  for (const key of Object.keys(process.env)) {
    env[key] = process.env[key]
  }
  env['TZ'] = 'UTC0'

  const stdout: string[] = []

  const options = {
    env,
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

async function run() : Promise<void> {

  try {

    // get project name
    const repositoryOwner = process.env.GITHUB_REPOSITORY_OWNER!.toLowerCase()
    const qualifiedRepositoryName = process.env.GITHUB_REPOSITORY!.toLowerCase()
    const repositoryName = qualifiedRepositoryName.replace(repositoryOwner + '/', '')
    const projectName = core.getInput('project-name') || repositoryName

    const buildConfiguration = core.getInput('build-configuration')
    if (!buildConfiguration) {
      throw new Error("No build-configuration supplied")
    }

    const dateFormat = core.getInput('date-format')
    const logFormat = core.getInput('format')

    const args : string[] = [
      'log',
      '-1',
      `--date=format-local:${dateFormat}`,
      `--pretty=${logFormat}`,
    ]

    const result = await execGit(args)
    var templateName = result.stdout
    templateName = templateName.replace('{project}', projectName)
    templateName = templateName.replace('{configuration}', buildConfiguration.toUpperCase())

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
