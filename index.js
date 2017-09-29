'use strict';

var fs = require('fs');
var wav = require('wav');

var inputFilename = './data/test-1.wav';
var outputFilename = './data/test-1.processed.wav';

var input = fs.createReadStream(inputFilename);
var reader = new wav.Reader(input);
var writer;

var writerOk = false;
var numberOfFrames = 0;

var channelBuffer;
var frameBuffer;
var channelBufferSize;
var frameBufferSize;

reader.on('error', function (err) {
  console.error('Reader error: %s', err);
});

reader.on('format', function (format) {
  channelBufferSize = reader.bitDepth / 8;
  frameBufferSize = reader.channels * channelBufferSize;
  writer = new wav.FileWriter(outputFilename, format);
  writerOk = true;
  writer.on('drain', function () {
    writerOk = true;
    processFile();
  });
});

reader.on('readable', function () {
  processFile();
});

var processFile = function processFile() {
  while (writerOk && null !== (frameBuffer = reader.read(frameBufferSize))) {
    processFrame(frameBuffer);
  }
}

var processFrame = function processFrame(frameBuffer) {
  var shouldWriteFrame = false;

  // For each channel, check if any is above threshold
  // If yes, write whole frame to writer
  for (var i = 0; i < reader.channels; i++) {
    channelBuffer = frameBuffer.slice(
      i * channelBufferSize,
      (i + 1) * channelBufferSize
    );

    if (reader.bitDepth === 8) {
      // Special case for 8-bit WAV files, where amplitude is unsigned
      // We are correcting it to make silence 0
      var amplitude = reader.endianness === 'LE'
        ? channelBuffer.readUIntLE(0, channelBufferSize)
        : channelBuffer.readUIntBE(0, channelBufferSize);
        amplitude = amplitude - 128;
    } else {
      var amplitude = reader.endianness === 'LE'
        ? channelBuffer.readIntLE(0, channelBufferSize)
        : channelBuffer.readIntBE(0, channelBufferSize);
    }
    // Normalise amplitude to positive values between 0 and 1
    amplitude = Math.abs(amplitude) / Math.pow(2, reader.bitDepth);

    if (amplitude > 0.001) {
      shouldWriteFrame = true;
      break;
    }
  }

  if (shouldWriteFrame) {
    writerOk = writer.write(frameBuffer);
    numberOfFrames++;
  }
};

reader.on('end', () => {
  console.log('Finished writing. Frames written: ' + numberOfFrames);
  writer.end();
});

// pipe the WAVE file to the Reader instance
input.pipe(reader);
