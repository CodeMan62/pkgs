import commander, { Command, OptionValues } from "commander";
import { version as swcCoreVersion } from "@swc/core";
import type { Options } from "@swc/core";
import { readFileSync } from "fs";
import { resolve } from "path";

const DEFAULT_EXTENSIONS = [
    ".js",
    ".jsx",
    ".es6",
    ".es",
    ".mjs",
    ".ts",
    ".tsx",
    ".cts",
    ".mts",
];

const pkg = require("../../package.json");

let program: Command;

export const initProgram = () => {
    program = new commander.Command();

    /* istanbul ignore next */
    if (process.env.NODE_ENV === "test") {
        program.exitOverride();
    }

    program.option(
        "-f, --filename [filename]",
        "filename to use when reading from stdin - this will be used in source-maps, errors etc"
    );

    program.option("--config-file [path]", "Path to a .swcrc file to use");

    program.option(
        "--cli-config-file [path]",
        "Path to a JSON file containing CLI options. " +
        "Options provided directly via command line override the ones in the configuration file."
    );

    program.option(
        "--env-name [name]",
        "The name of the 'env' to use when loading configs and plugins. " +
        "Defaults to the value of SWC_ENV, or else NODE_ENV, or else 'development'."
    );

    program.option("--no-swcrc", "Whether or not to look up .swcrc files");

    program.option(
        "--delete-dir-on-start",
        "Whether or not delete output directory on start"
    );

    program.option(
        "--ignore [list]",
        "list of glob paths to **not** compile",
        collect
    );

    program.option(
        "--only [list]",
        "list of glob paths to **only** compile",
        collect
    );

    program.option("-w, --watch", "Recompile files on changes");

    program.option("-q, --quiet", "Suppress compilation output");

    program.option(
        "-s, --source-maps [true|false|inline|both]",
        "generate source maps",
        unstringify
    );

    program.option(
        "--source-map-target [string]",
        "set `file` on returned source map"
    );

    program.option(
        "--source-file-name [string]",
        "set `sources[0]` on returned source map"
    );

    program.option(
        "--source-root [filename]",
        "the root from which all sources are relative"
    );

    program.option(
        "-o, --out-file [out]",
        "Compile all input files into a single file"
    );

    program.option(
        "-d, --out-dir [out]",
        "Compile an input directory of modules into an output directory"
    );

    program.option(
        "--out-file-extension [string]",
        "Use a specific extension for the output files"
    );

    program.option(
        "-D, --copy-files",
        "When compiling a directory copy over non-compilable files"
    );

    program.option(
        "--strip-leading-paths",
        "Remove the leading directory (including all parent relative paths) when building the final output path",
        false
    );

    program.option(
        "--include-dotfiles",
        "Include dotfiles when compiling and copying non-compilable files"
    );

    program.option(
        "-C, --config <config>",
        "Override a config from .swcrc file. e.g. -C module.type=amd -C module.moduleId=hello",
        collect
    );

    program.option(
        "--sync",
        "Invoke swc synchronously. Useful for debugging.",
        collect
    );

    program.option(
        "--workers [number]",
        "The number of workers to use for parallel processing"
    );

    program.option(
        "--log-watch-compilation",
        "Log a message when a watched file is successfully compiled",
        true
    );

    program.option("--extensions [list]", "Use specific extensions", collect);

    program.version(`
@swc/cli: ${pkg.version}
@swc/core: ${swcCoreVersion}
`);

    program.usage("[options] <files ...>");
    program.addHelpText(
        "beforeAll",
        `
============================================================================================
Beta version of @swc/cli is now available via 'swcx' command.
This'll be a default command for @swc/cli@1.
Please give it a try and report any issues at https://github.com/swc-project/swc/issues/4017
============================================================================================

`
    );
};

function unstringify(val: string): any {
    try {
        return JSON.parse(val);
    } catch {
        return val;
    }
}

function loadCLIConfigFile(
    program: Command,
    opts: OptionValues,
    path: string
): OptionValues {
    let configOpts: OptionValues;
    let contents: string;

    // Parse the JSON file
    try {
        contents = readFileSync(resolve(process.cwd(), path), "utf-8");
    } catch (e) {
        throw new Error(`Cannot read CLI config file "${path}".`);
    }

    try {
        configOpts = JSON.parse(contents);
    } catch (e) {
        throw new Error(
            `CLI config file "${path}" is not a well-formed JSON file.`
        );
    }

    // Convert kebab case options in camel case one
    configOpts = Object.fromEntries(
        Object.entries(configOpts).map(([key, value]) => {
            const camelCaseKey = key.replace(/(-[-a-z])/g, (_, m) =>
                m.substring(1).toUpperCase()
            );
            return [camelCaseKey, value];
        })
    );

    // Split existing options in default and provided one
    const defaults = [];
    const provided = [];

    for (const pair of Object.entries(opts)) {
        if (program.getOptionValueSource(pair[0]) === "default") {
            defaults.push(pair);
        } else {
            provided.push(pair);
        }
    }

    // Merge options back with right priority
    return {
        ...Object.fromEntries(defaults),
        ...configOpts,
        ...Object.fromEntries(provided),
    };
}

function verifyArgsErrors(errors: string[]): void {
    if (errors.length) {
        console.error("swc:");
        for (const error of errors) {
            console.error("  " + error);
        }
        process.exit(2);
    }
}

function collect(
    value: string,
    previousValue?: string[]
): string[] | undefined {
    // If the user passed the option with no value, like "babel file.js --presets", do nothing.
    /* istanbul ignore next */
    if (typeof value !== "string") return previousValue;

    const values = value.split(",");

    return previousValue ? previousValue.concat(values) : values;
}

export interface CliOptions {
    readonly outDir: string;
    readonly outFile: string;
    readonly stripLeadingPaths: boolean;
    /**
     * Invoke swc using transformSync. It's useful for debugging.
     */
    readonly sync: boolean;
    readonly workers: number | undefined;
    readonly sourceMapTarget?: string;
    readonly filename: string;
    readonly filenames: string[];
    readonly extensions: string[];
    readonly watch: boolean;
    readonly copyFiles: boolean;
    readonly outFileExtension?: string;
    readonly includeDotfiles: boolean;
    readonly deleteDirOnStart: boolean;
    readonly quiet: boolean;

    readonly only: string[];
    readonly ignore: string[];
}

export interface Callbacks {
    readonly onSuccess?: (data: {
        duration: number;
        /** count of compiled files */
        compiled?: number;
        /** count of copied files */
        copied?: number;
        filename?: string;
    }) => any;
    readonly onFail?: (data: {
        duration: number;
        reasons: Map<string, string>;
    }) => any;
    readonly onWatchReady?: () => any;
}

export default function parserArgs(args: string[]) {
    program.parse(args);
    let opts = program.opts();

    if (opts.cliConfigFile) {
        try {
            opts = loadCLIConfigFile(program, opts, opts.cliConfigFile);
        } catch (e: any) {
            verifyArgsErrors([e.message]);
            return;
        }
    }

    const filenames = program.args;
    const errors = [];

    if (opts.outDir && !filenames.length) {
        errors.push("--out-dir requires filenames");
    }

    if (opts.outFile && opts.outDir) {
        errors.push("--out-file and --out-dir cannot be used together");
    }

    if (opts.watch) {
        if (!opts.outFile && !opts.outDir) {
            errors.push("--watch requires --out-file or --out-dir");
        }

        if (!filenames.length) {
            errors.push("--watch requires filenames");
        }
    }

    if (
        !opts.outDir &&
        filenames.length === 0 &&
        typeof opts.filename !== "string" &&
        opts.swcrc !== false
    ) {
        errors.push(
            "stdin compilation requires either -f/--filename [filename] or --no-swcrc"
        );
    }

    let workers: number | undefined;
    if (opts.workers != null) {
        workers = parseFloat(opts.workers);
        if (!Number.isInteger(workers) || workers < 0) {
            errors.push(
                "--workers must be a positive integer (found " +
                opts.workers +
                ")"
            );
        }
    }

    verifyArgsErrors(errors);

    const swcOptions: Options = {
        jsc: {
            parser: undefined,
            transform: {},
        },
        sourceFileName: opts.sourceFileName,
        sourceRoot: opts.sourceRoot,
        configFile: opts.configFile,
        swcrc: opts.swcrc,
    };

    if (opts.sourceMaps !== undefined) {
        swcOptions.sourceMaps = opts.sourceMaps;
    }

    if (opts.config) {
        for (const cfg of opts.config as string[]) {
            const i = cfg.indexOf("=");
            let key: string;
            let value: any;
            if (i === -1) {
                key = cfg;
                value = true;
            } else {
                key = cfg.substring(0, i);
                value = unstringify(cfg.substring(i + 1));
            }
            // https://github.com/swc-project/cli/issues/45
            let options = swcOptions as { [key: string]: any };
            const keyParts = key.split(".");
            const lastIndex = keyParts.length - 1;
            for (const [index, keyPart] of keyParts.entries()) {
                if (options[keyPart] === undefined && index !== lastIndex) {
                    options[keyPart] = {};
                }
                if (index === lastIndex) {
                    options[keyPart] = value;
                } else {
                    options = options[keyPart];
                }
            }
        }
    }

    const cliOptions: CliOptions = {
        outDir: opts.outDir,
        outFile: opts.outFile,
        stripLeadingPaths: Boolean(opts.stripLeadingPaths),
        filename: opts.filename,
        filenames,
        sync: !!opts.sync,
        workers,
        sourceMapTarget: opts.sourceMapTarget,
        extensions: opts.extensions || DEFAULT_EXTENSIONS,
        watch: !!opts.watch,
        copyFiles: !!opts.copyFiles,
        outFileExtension: opts.outFileExtension,
        includeDotfiles: !!opts.includeDotfiles,
        deleteDirOnStart: Boolean(opts.deleteDirOnStart),
        quiet: !!opts.quiet,
        only: opts.only || [],
        ignore: opts.ignore || [],
    };
    return {
        swcOptions,
        cliOptions,
    };
}
