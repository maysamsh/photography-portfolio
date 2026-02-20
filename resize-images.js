#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);

// Helper function to flush stdout for real-time logging
function log(message) {
    console.log(message);
    // Force flush stdout
    if (process.stdout.isTTY) {
        process.stdout.write('');
    }
}

const FULL_SIZE_WIDTH = 1024;
const THUMB_WIDTH = 512;
const SOURCE_DIR = 'images';
const FULL_DIR = 'images/full';
const THUMB_DIR = 'images/thumbs';

async function getImageDimensions(imagePath) {
    try {
        const { stdout } = await execAsync(`identify -format "%wx%h" "${imagePath}"`);
        const [width, height] = stdout.split('x').map(Number);
        return { width, height };
    } catch (error) {
        log(`  🔍 Error reading dimensions for ${path.basename(imagePath)}: ${error.message}`);
        return null;
    }
}

async function resizeImage(inputPath, outputPath, width) {
    try {
        await execAsync(`convert "${inputPath}" -resize ${width}x -quality 85 "${outputPath}"`);
        return true;
    } catch (error) {
        log(`  🔧 Error resizing ${path.basename(inputPath)} to ${width}px: ${error.message}`);
        return false;
    }
}

async function copyImage(inputPath, outputPath) {
    try {
        await execAsync(`cp "${inputPath}" "${outputPath}"`);
        return true;
    } catch (error) {
        log(`  📋 Error copying ${path.basename(inputPath)}: ${error.message}`);
        return false;
    }
}

async function deleteSourceImage(imagePath) {
    try {
        await fs.promises.unlink(imagePath);
        return true;
    } catch (error) {
        log(`  🗑️  Error deleting source image ${path.basename(imagePath)}: ${error.message}`);
        return false;
    }
}

async function ensureDirectory(dir) {
    if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
    }
}

/** Output filename: strip leading underscore so Jekyll copies files without needing include "_*". */
function outputFilename(sourceFile) {
    const base = path.basename(sourceFile);
    return base.startsWith('_') ? base.slice(1) : base;
}

async function processImage(imageFile) {
    const sourcePath = path.join(SOURCE_DIR, imageFile);
    const outFile = outputFilename(imageFile);
    const fullPath = path.join(FULL_DIR, outFile);
    const thumbPath = path.join(THUMB_DIR, outFile);
    
    log(`\n=== Processing: ${imageFile} ===`);
    
    const dimensions = await getImageDimensions(sourcePath);
    if (!dimensions) {
        log(`  ❌ Skipping ${imageFile} - cannot read dimensions`);
        return false;
    }
    
    log(`  Source dimensions: ${dimensions.width}x${dimensions.height}`);
    
    let fullSuccess = false;
    let thumbSuccess = false;
    let operationType = '';
    
    if (dimensions.width > FULL_SIZE_WIDTH) {
        log(`  📐 Source is larger than ${FULL_SIZE_WIDTH}px, will resize`);
        operationType = 'resize';
        fullSuccess = await resizeImage(sourcePath, fullPath, FULL_SIZE_WIDTH);
        if (fullSuccess) {
            log(`  ✅ Resized to ${FULL_SIZE_WIDTH}px and saved to: ${fullPath}`);
        } else {
            log(`  ❌ Failed to resize image`);
        }
    } else {
        log(`  📋 Source is same size or smaller (≤ ${FULL_SIZE_WIDTH}px), will copy`);
        operationType = 'copy';
        fullSuccess = await copyImage(sourcePath, fullPath);
        if (fullSuccess) {
            log(`  ✅ Copied as-is to: ${fullPath}`);
        } else {
            log(`  ❌ Failed to copy image`);
        }
    }
    
    if (fullSuccess) {
        log(`  🖼️  Creating thumbnail (${THUMB_WIDTH}px)`);
        thumbSuccess = await resizeImage(fullPath, thumbPath, THUMB_WIDTH);
        if (thumbSuccess) {
            log(`  ✅ Thumbnail created at: ${thumbPath}`);
        } else {
            log(`  ❌ Failed to create thumbnail`);
        }
    }
    
    if (fullSuccess && thumbSuccess) {
        log(`  🗑️  Deleting source image: ${sourcePath}`);
        const deleteSuccess = await deleteSourceImage(sourcePath);
        if (deleteSuccess) {
            log(`  ✅ Source image deleted successfully`);
            log(`  🎉 ${imageFile} - ${operationType === 'resize' ? 'RESIZED' : 'COPIED'} and processed successfully!`);
            return true;
        } else {
            log(`  ⚠️  Failed to delete source image (but processing completed)`);
            log(`  ⚠️  ${imageFile} - ${operationType === 'resize' ? 'RESIZED' : 'COPIED'} but source not deleted`);
            return true; // Still consider it a success since images were processed
        }
    }
    
    log(`  ❌ ${imageFile} - FAILED to process`);
    return false;
}

async function main() {
    log('🚀 Starting image processing...');
    log(`📏 Full size width: ${FULL_SIZE_WIDTH}px`);
    log(`🖼️  Thumbnail width: ${THUMB_WIDTH}px`);
    log('');
    
    log('📁 Checking/creating directories...');
    await ensureDirectory(FULL_DIR);
    log(`  ✅ ${FULL_DIR} ready`);
    await ensureDirectory(THUMB_DIR);
    log(`  ✅ ${THUMB_DIR} ready`);
    
    if (!fs.existsSync(SOURCE_DIR)) {
        log(`❌ Source directory '${SOURCE_DIR}' does not exist`);
        process.exit(1);
    }
    
    const files = await fs.promises.readdir(SOURCE_DIR);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.gif', '.bmp', '.webp'];
    const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return imageExtensions.includes(ext);
    });
    
    if (imageFiles.length === 0) {
        log('ℹ️  No image files found in source directory');
        return;
    }
    
    log(`📊 Found ${imageFiles.length} image files to process`);
    log('');
    
    let successCount = 0;
    let failCount = 0;
    let resizeCount = 0;
    let copyCount = 0;
    
    for (let i = 0; i < imageFiles.length; i++) {
        const imageFile = imageFiles[i];
        log(`[${i + 1}/${imageFiles.length}]`);
        const result = await processImage(imageFile);
        if (result === true) {
            successCount++;
            // We can't track resize vs copy from processImage return value
            // but the logging will show it for each image
        } else {
            failCount++;
        }
    }
    
    log('\n' + '='.repeat(50));
    log('📋 PROCESSING SUMMARY');
    log('='.repeat(50));
    log(`✅ Successfully processed: ${successCount} images`);
    log(`❌ Failed: ${failCount} images`);
    log(`📊 Total images: ${imageFiles.length}`);
    log('');
    log('💡 Check individual logs above for resize/copy details');
    log('='.repeat(50));
    
    if (failCount > 0) {
        log('\n⚠️  Some images failed to process. Check logs above.');
        process.exit(1);
    } else {
        log('\n🎉 All images processed successfully!');
    }
}

if (require.main === module) {
    main().catch(error => {
        log(`❌ Fatal error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { processImage, getImageDimensions };