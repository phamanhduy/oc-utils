const winstonCloudWatch = require('winston-cloudwatch');

let serviceName = '';

function createWinstonCloudWatch(options = {}) {
  if (!options.logGroupName || !options.accessKeyId) {
    return null;
  }
  serviceName = options.serviceName || '';
  return new winstonCloudWatch({
    logGroupName: options.logGroupName,
    logStreamName: options.logStreamName,
    awsAccessKeyId: options.accessKeyId,
    awsSecretKey: options.secretAccessKey,
    awsSecretKeyId: options.accessKeyId,
    awsRegion: options.region,
    messageFormatter,
  });
}

function messageFormatter({ level, message, ...info }) {
  const processedInfo = _process(info);
  processedInfo.serviceName = serviceName;
  try {
    return `${level}: ${message} ${JSON.stringify(processedInfo)}`;
  } catch (e) {
    return '';
  }
}

function _process(info) {
  if (!info) {
    return '';
  }
  if (info instanceof Error) {
    return {
      stack: info.stack,
      message: info.message
    };
  }
  ['error', 'err', 'e'].forEach(key => {
    if (info[key] instanceof Error) {
      info[key] = {
        message: info[key].message,
        stack: info[key].stack,
      }
    }
  });
  return info;
}

exports.createWinstonCloudWatch = createWinstonCloudWatch;
