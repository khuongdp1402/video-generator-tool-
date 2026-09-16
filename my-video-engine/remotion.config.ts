/**
 * Remotion configuration for AI Video Engine.
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Default cache is too small for this project's concurrency and causes
// "No frame found at position X" crashes from OffthreadVideo under load.
Config.setOffthreadVideoCacheSizeInBytes(2000000000);
