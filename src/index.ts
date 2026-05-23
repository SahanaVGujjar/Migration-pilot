import { createCLI } from './cli';

const program = createCLI();
program.parse(process.argv);
