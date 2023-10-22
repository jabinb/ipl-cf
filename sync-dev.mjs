import fs from 'fs';
import path from 'path';
import axios from 'axios';
import {configDotenv} from "dotenv";

configDotenv({
  path: '.dev.vars',
});

const endpoint = 'http://127.0.0.1:2083/put/';
const launcherFile = process.env.SHARD_NAME + 'Launcher.exe';
const prefix = 'uo-files/'

// Read the input directory from the command line arguments
const dir = path.normalize(path.resolve(process.argv[2]));

main().finally(() => process.exit());


async function main() {
  // Check if a directory path was provided
  if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.error('Please provide the input directory path as a command line argument.');
  } else {
    console.log('Uploading directory', dir);
    await sendFilesRecursively(dir);

    await axios.put(`${endpoint}${launcherFile}`, fs.readFileSync(path.join(dir, '..', launcherFile)));
  }
}

async function sendFilesRecursively(directoryPath) {
  try {
    const files = fs.readdirSync(directoryPath);

    for (const file of files) {
      const filePath = path.join(directoryPath, file);

      if (fs.statSync(filePath).isDirectory()) {
        await sendFilesRecursively(filePath);
      } else {
        const fileData = fs.readFileSync(filePath);

        const relativePath = filePath.replace(dir, '').replace(/^\//, '');
        console.log(`Uploading file ${relativePath} ...`);

        await axios.put(`${endpoint}${prefix}${relativePath}`, fileData);

        console.log(`File ${relativePath} sent successfully.`);
      }
    }
  } catch (error) {
    console.error(`Error: ${error}`);
    if (axios.isAxiosError(error)) {
      console.log(error.response.data);
    }
  }
}

