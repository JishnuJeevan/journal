#!/usr/bin/env node
import { buildProgram } from '../src/cli.js';

buildProgram().parseAsync(process.argv);
