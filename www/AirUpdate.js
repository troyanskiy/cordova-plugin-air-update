var exec = require('cordova/exec');

var airServer = '';
var airChannels = {};

var initialVersion = '';

var activeChannel = null;

var cordovaHTTP = cordova.plugin.http;

exports.init = function (codeDef) {
  return readFile(cordova.file.applicationDirectory + 'config.xml')
    .then(function (data) {

      var doc = createXMLDocument(data);

      var widget = doc.querySelector('widget');
      if (widget) {
        initialVersion = widget.getAttribute('version');
      }

      var serverElm = doc.querySelector('air-update-server');

      if (serverElm) {
        airServer = serverElm.getAttribute('value');
      }

      var channelElms = doc.querySelectorAll('air-update-channel');
      for (var i = 0; i < channelElms.length; i++) {

        var code = channelElms[i].getAttribute('code');
        var id = channelElms[i].getAttribute('value');
        var def = channelElms[i].getAttribute('def');
        var name = channelElms[i].getAttribute('name');

        if (code && id) {

          airChannels[code] = {
            id: id,
            name: name,
            code: code,
            def: def && def.toLowerCase() === 'true'
          };

          if (airChannels[code].def) {
            console.log('Setting active AirUpdate channel to ' + code);
            activeChannel = airChannels[code];
          }

        }

      }

      if (codeDef && airChannels[codeDef]) {
        activeChannel = airChannels[codeDef];
      }

    })
    .then(function () {
      return getDirectory(cordova.file.dataDirectory, 'AirUpdate');
    })
    .then(function () {
      return new Promise(function (resolve, reject) {
        cordovaHTTP.validateDomainName(false, resolve, reject);
      });
    })
    .catch(function (err) {
      console.warn(err);
    });
};

/**
 * Set update channel
 *
 * @param code
 * @return {boolean}
 */
exports.setChannel = function (code) {
  if (!airChannels[code]) {
    return false;
  }
  activeChannel = airChannels[code];
  return true;
};

/**
 * Check latest version on server
 *
 * @return {*}
 */
exports.getLatestServerVersion = function () {

  if (!activeChannel) {
    console.log('Active channel is not set');
    return Promise.reject(new Error('Active AirUpdate channel is not set'));
  }

  var url = getServerChannelAddress() + '/meta/latest';

  return requestGet(url, 'GET')
    .then(function (data) {
      var dataJson = JSON.parse(data.data);
      return dataJson.version;
    })
    .catch(function (err) {
      return null;
    });

};

/**
 * Get current version
 */
exports.getCurrentLocalVersion = function () {

  readFile(getPathRoot() + 'current.json')
    .then(function (data) {
      data = JSON.parse(data);
      return data.version;
    })
    .catch(function () {
      return initialVersion;
    });

};

exports.downloadVersion = function (version) {

  console.log('Download version ' + version);

  var srcZip = getServerChannelAddress() + '/download/' + version;
  var dstZip = window.cordova.file.tempDirectory + version + '.zip';

  var srcMeta = getServerChannelAddress() + '/meta/' + version;
  var dstMeta = window.cordova.file.tempDirectory + version + '.json';

  return Promise.all([
    downloadFile(srcZip, dstZip),
    downloadFile(srcMeta, dstMeta),
    getDirectory(getPathRoot(), 'metas')
  ])
    .then(function () {
      return unZip(dstZip, getRepoDirPath());
    })
    .then(function () {
      return moveFile(dstMeta, getMetasDirPath(), getChannelVersionName(version) + '.json');
    })
    .then(function () {
      return removeFile(dstZip);
    });

};

exports.setupVersion = function (version) {

  // todo check all file exists

  var channelVersionName = getChannelVersionName(version);
  var wwwDir = 'www_' + channelVersionName;

  return getDirectory(getPathRoot(), wwwDir)
    .then(removeDirectory)
    .then(function () {
      return readFile(getMetasDirPath() + channelVersionName + '.json');
    })
    .then(function (data) {
      data = JSON.parse(data);

      var keys = Object.keys(data.filesMap);

      var pathsToCreate = [];

      for (var i = 0; i < keys.length; i++) {

        // console.log(keys[i]);

        var path = keys[i].split('/').slice(0, -1).join('/');
        if (path) {

          for (var j = 0; path && j < pathsToCreate.length; j++) {
            if (pathsToCreate[j].indexOf(path) === 0) {
              path = null;
              break;
            }
            if (path.indexOf(pathsToCreate[j]) === 0) {
              pathsToCreate[j] = path;
              path = null;
            }
          }

          if (path) {
            pathsToCreate.push(path);
          }

        }

      }


      // creating directories
      var promise = Promise.resolve();
      pathsToCreate.forEach(function (path) {
        promise = promise
          .then(function () {
            return getDirectory(getPathRoot(), wwwDir + '/' + path);
          });
      });

      return promise
        .then(function () {
          return data;
        });

    })
    .then(function (data) {

      var filesMap = data.filesMap;
      var paths = Object.keys(filesMap);
      var repoPath = getRepoDirPath();
      var wwwPath = getPathRoot() + wwwDir + '/';

      var promise = Promise.resolve();

      paths.forEach(function (path) {

        var explodedPath = path.split('/');

        var src = repoPath + filesMap[path];
        var dstDir = wwwPath + explodedPath.slice(0, -1).join('/');
        var fileName = explodedPath[explodedPath.length - 1];

        promise = promise
          .then(function () {
            return copyFile(src, dstDir, fileName);
          });

      });

      return promise
        .then(function () {
          data.channelKey = activeChannel.code;
          return writeFile(getPathRoot(), 'current.json', JSON.stringify(data, null, 2));
        });

    })

    .catch(function (err) {
      console.log(err);
      throw err;
      // throw new Error('Version in not found');
    });

};

exports.getAllLocalVersions = function () {
  return resolveFSEntry(getMetasDirPath())
    .then(listDir)
    .then(function (entries) {

      // console.log(entries);

      var channelKey = activeChannel.code + '_';
      var channelKeyLength = channelKey.length;

      var versions = [];

      entries.forEach(function (entry) {
        if (entry.name.indexOf(channelKey) === 0) {
          versions.push(entry.name.substring(channelKeyLength, entry.name.length - 5));
        }
      });

      return versions;

    });
};

exports.deleteLocalVersions = function (versions) {
  //todo
};

exports.reload = function () {
  return new Promise(function (resolve, reject) {
    exec(resolve, reject, "AirUpdate", "reload", []);
  });
};

exports.clearWWWs = function () {
  return readFile(getPathRoot() + 'current.json')
    .then(function (data) {

      data = JSON.parse(data);

      var activeWWWDir = 'www_' + data.channelKey + '_' + data.version;

      return resolveFSEntry(getPathRoot())
        .then(listDir)
        .then(function (entries) {

          var removingPromises = [];

          for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            if (entry.isDirectory && entry.name !== activeWWWDir && entry.name.indexOf('www') === 0) {
              removingPromises.push(removeDirectory(entry));
            }
          }

          if (removingPromises.length) {
            return Promise.all(removingPromises);
          }

        });

    });
};

/**
 * Create and write to file
 *
 * @param path
 * @param fileName
 * @param data
 * @return {Promise}
 */
function writeFile(path, fileName, data) {

  //console.log(data);

  return resolveFSEntry(path)
    .then(function (dirEntry) {
      return getFileEntry(dirEntry, fileName);
    })
    .then(function (fileEntry) {
      return writeFileEntry(fileEntry, data);
    });
}

/**
 * Create file
 *
 * @param dirEntry
 * @param fileName
 * @return {Promise}
 */
function getFileEntry(dirEntry, fileName) {
  return new Promise(function (resolve, reject) {
    dirEntry.getFile(fileName, {create: true, exclusive: false}, resolve, reject);
  });
}

/**
 * Write to file entry
 *
 * @param fileEntry
 * @param data
 * @return {Promise}
 */
function writeFileEntry(fileEntry, data) {

  return new Promise(function (resolve, reject) {
    fileEntry.createWriter(function (fileWriter) {

      fileWriter.onwriteend = function () {
        resolve();
      };

      fileWriter.onerror = function (e) {
        reject(e);
      };

      data = new Blob([data], {type: 'text/plain'});

      fileWriter.write(data);
    });
  });

}

/**
 * HTTP get request
 *
 * @param url
 * @return {Promise}
 */
function requestGet(url) {
  return new Promise(function (resolve, reject) {
    cordovaHTTP.get(url, {}, {}, resolve, reject);
  });
}

/**
 * Download files
 *
 * @param src
 * @param dst
 * @return {Promise}
 */
function downloadFile(src, dst) {
  return new Promise(function (resolve, reject) {
    cordovaHTTP.downloadFile(src, {}, {}, dst, resolve, reject);
  });
}

/**
 * Delete file from FS
 *
 * @param file
 * @return {Promise}
 */
function removeFile(file) {
  return resolveFSEntry(file).then(removeFileEntry);
}

/**
 * Delete file by entry
 *
 * @param fileEntry
 * @return {Promise}
 */
function removeFileEntry(fileEntry) {
  return new Promise(function (resolve, reject) {
    fileEntry.remove(resolve, reject);
  })
    .catch(function (err) {
      console.log('Error removing file', err);
    });
}

/**
 * Removes direcotry
 *
 * @param dirEntry
 * @return {Promise}
 */
function removeDirectory(dirEntry) {
  return new Promise(function (resolve, reject) {
    dirEntry.removeRecursively(resolve, reject);
  });
}

/**
 * Move file
 *
 * @param src
 * @param path
 * @param fileName
 * @return {Promise}
 */
function moveFile(src, path, fileName) {
  return Promise.all([
    resolveFSEntry(src),
    resolveFSEntry(path)
  ])
    .then(function (data) {
      var src = data[0];
      var path = data[1];
      return moveTo(src, path, fileName);
    });
}

/**
 * List dir
 *
 * @param pathEntry
 * @return {Promise}
 */
function listDir(pathEntry) {

  return new Promise(function (resolve, reject) {
    var reader = pathEntry.createReader();
    reader.readEntries(
      function (entries) {
        resolve(entries);
      },
      function (err) {
        reject(err);
      }
    );
  });

}

/**
 * Move file entries
 *
 * @param srce
 * @param destdir
 * @param newName
 * @return {Promise}
 */
function moveTo(srce, destdir, newName) {
  return new Promise(function (resolve, reject) {
    srce.moveTo(destdir, newName, function (deste) {
      resolve(deste);
    }, function (err) {
      reject(err);
    });
  });
}

/**
 * Copy file
 *
 * @param src
 * @param path
 * @param fileName
 * @return {Promise}
 */
function copyFile(src, path, fileName) {
  return Promise.all([
    resolveFSEntry(src),
    resolveFSEntry(path)
  ])
    .then(function (data) {
      var src = data[0];
      var path = data[1];
      return copyTo(src, path, fileName);
    });
}

/**
 * Copy file entries
 *
 * @param srce
 * @param destdir
 * @param newName
 * @return {Promise}
 */
function copyTo(srce, destdir, newName) {
  return new Promise(function (resolve, reject) {
    srce.copyTo(destdir, newName, function (deste) {
      resolve(deste);
    }, function (err) {
      reject(err);
    });
  });
}


/**
 * Un zip
 *
 * @param file
 * @param dst
 * @return {Promise}
 */
function unZip(file, dst) {
  return new Promise(function (resolve, reject) {
    zip.unzip(file, dst, function (result) {
      if (result === 0) {
        resolve();
      } else {
        reject();
      }
    });
  });
}

/**
 * Resolve file entry
 *
 * @param path
 * @return {Promise}
 */
function resolveFSEntry(path) {
  return new Promise(function (resolve, reject) {
    try {
      window.resolveLocalFileSystemURL(path, function (entry) {
        resolve(entry);
      }, function (err) {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Creates directory
 *
 * @param path
 * @param dirName
 * @return {Promise}
 */
function getDirectory(path, dirName) {

  return resolveFSEntry(path)
    .then(function (dirEntry) {
      return getDirectoryEntry(dirEntry, dirName.split('/'));
    });

}

/**
 * Recursively creates directories
 *
 * @param dirEntry
 * @param dirNames
 * @return {*}
 */
function getDirectoryEntry(dirEntry, dirNames) {

  if (dirNames.length === 0) {
    return Promise.resolve(dirEntry);
  }

  return new Promise(function (resolve, reject) {
    dirEntry.getDirectory(dirNames.shift(), {create: true}, function (subDirEntry) {
      getDirectoryEntry(subDirEntry, dirNames)
        .then(resolve)
        .catch(reject);
    }, function (err) {
      reject(err);
    });
  });

}


/**
 * Read file from path
 *
 * @param path
 * @return {Promise}
 */
function readFile(path) {

  return resolveFSEntry(path)
    .then(readFileEntry);

}

/**
 * Read file entry
 *
 * @param fileEntry
 * @return {Promise}
 */
function readFileEntry(fileEntry) {
  return new Promise(function (resolve, reject) {
    fileEntry.file(function (file) {
      var reader = new FileReader();

      reader.onloadend = function () {
        resolve(this.result);
      };

      reader.readAsText(file);
    }, function (err) {
      reject(err);
    });
  });
}

/**
 * Create XML Document
 *
 * @param txt
 * @return {*}
 */
function createXMLDocument(txt) {

  var xmlDoc, parser;

  if (window.DOMParser) {
    parser = new DOMParser();
    xmlDoc = parser.parseFromString(txt, 'text/xml');
  } else {
    // Internet Explorer
    xmlDoc = new ActiveXObject('Microsoft.XMLDOM');
    xmlDoc.async = false;
    xmlDoc.loadXML(txt);
  }

  return xmlDoc;
}

/**
 * Get air update path
 *
 * @return {string}
 */
function getPathRoot() {
  return cordova.file.dataDirectory + 'AirUpdate/';
}


/**
 * Path to repo
 *
 * @return {string}
 */
function getRepoDirPath() {
  return getPathRoot() + 'repo/';
}

/**
 * Path to metas
 *
 * @return {string}
 */
function getMetasDirPath() {
  return getPathRoot() + 'metas/';
}

/**
 * Get server deploy channel address
 * @return {string}
 */
function getServerChannelAddress() {
  return airServer + '/deploy/' + activeChannel.id;
}

/**
 * Get name for channel and version
 *
 * @param version
 * @return {string}
 */
function getChannelVersionName(version) {
  return activeChannel.code + '_' + version;
}

