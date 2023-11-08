import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { PositionalArg, showHelp } from './help';
import { PatternKeys, generate, generateAll } from '../generate';
import { log, parsePattern } from '../util';

const command = 'spec2cdk';
const args: PositionalArg[] = [{
  name: 'output-path',
  required: true,
  description: 'The directory the generated code will be written to',
}];
const config = {
  'help': {
    short: 'h',
    type: 'boolean',
    description: 'Show this help',
  },
  'debug': {
    type: 'boolean',
    description: 'Show additional debug output',
  },
  'pattern': {
    type: 'string',
    default: '%moduleName%/%serviceShortName%.generated.ts',
    description: 'File and path pattern for generated files',
  },
  'augmentations': {
    type: 'string',
    default: '%moduleName%/%serviceShortName%-augmentations.generated.ts',
    description: 'File and path pattern for generated augmentations files',
  },
  'metrics': {
    type: 'string',
    default: '%moduleName%/%serviceShortName%-canned-metrics.generated.ts',
    description: 'File and path pattern for generated canned metrics files ',
  },
  'service': {
    type: 'string',
    description: 'Generate files only for a specific service, e.g. aws-lambda',
  },
  'clear-output': {
    type: 'boolean',
    default: false,
    description: 'Completely delete the output path before generating new files',
  },
  'augmentations-support': {
    type: 'boolean',
    default: false,
    description: 'Generates additional files required for augmentation files to compile. Use for testing only',
  },
} as const;

const helpText = `Path patterns can use the following variables:

    %moduleName%          The name of the module, e.g. aws-lambda
    %serviceName%         The full name of the service, e.g. aws-lambda
    %serviceShortName%    The short name of the service, e.g. lambda

Note that %moduleName% and %serviceName% can be different if multiple services are generated into a single module.`;

const help = () => showHelp(command, args, config, helpText);

async function main(argv: string[]) {
  const {
    positionals,
    values: options,
  } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: config,
  });

  if (options.help) {
    help();
    return;
  }

  if (options.debug) {
    process.env.DEBUG = '1';
  }
  log.debug('CLI args', positionals, options);

  const outputDir = positionals[0];
  if (!outputDir) {
    throw new Error('Please specify the output-path');
  }

  const pss: Record<PatternKeys, true> = { moduleName: true, serviceName: true, serviceShortName: true };

  const outputPath = outputDir ?? path.join(__dirname, '..', 'services');
  const resourceFilePattern = parsePattern(
    stringOr(options.pattern, path.join('%moduleName%', '%serviceShortName%.generated.ts')),
    pss,
  );

  const augmentationsFilePattern = parsePattern(
    stringOr(options.augmentations, path.join('%moduleName%', '%serviceShortName%-augmentations.generated.ts')),
    pss,
  );

  const cannedMetricsFilePattern = parsePattern(
    stringOr(options.metrics, path.join('%moduleName%', '%serviceShortName%-canned-metrics.generated.ts')),
    pss,
  );

  const generatorOptions = {
    outputPath,
    filePatterns: {
      resources: resourceFilePattern,
      augmentations: augmentationsFilePattern,
      cannedMetrics: cannedMetricsFilePattern,
    },
    clearOutput: options['clear-output'],
    augmentationsSupport: options['augmentations-support'],
    debug: options.debug as boolean,
  };

  if (options.service && typeof options.service === 'string') {
    const moduleMap = { [options.service]: { services: [options.service] } };
    await generate(moduleMap, generatorOptions);
    return;
  }

  await generateAll(generatorOptions);
}

main(process.argv.splice(2)).catch((e) => {
  log.error(`Error: ${e.message}\n`);
  showHelp(command, args);
  process.exitCode = 1;
});

function stringOr(pat: unknown, def: string) {
  if (!pat) {
    return def;
  }
  if (typeof pat !== 'string') {
    throw new Error(`Expected string, got: ${JSON.stringify(pat)}`);
  }
  return pat;
}
