/* jshint node: true */
'use strict';

var Promise = require('rsvp').Promise;
var DeployPluginBase = require('ember-cli-deploy-plugin');

var path = require('path');
var fs = require('fs');
var denodeify = require('rsvp').denodeify;
var readFile = denodeify(fs.readFile);

module.exports = {
  name: 'ember-cli-deploy-mysql',

  createDeployPlugin: function (options) {
    var MySQL = require('./lib/mysql');

    var DeployPlugin = DeployPluginBase.extend({
      name: options.name,

      defaultConfig: {
        host: 'localhost',
        port: function (context) {
          if (context.tunnel && context.tunnel.srcPort) {
            return context.tunnel.srcPort;
          }
          else {
            return 3306;
          }
        },
        maxRecentUploads: 10,
        distDir: function (context) {
          return context.distDir;
        },
        filePattern: 'index.html',
        tableName: function (context) {
          return context.project.name().replace(/-/g, '_') + '_bootstrap';
        },
        revisionKey: function (context) {
          return context.commandOptions.revision || (context.revisionData && context.revisionData.revisionKey);
        },
        deployClient: function (context, pluginHelper) {
          this.port = pluginHelper.readConfig('port');
          var mysqlLib = context._mysqlLib;
          return new MySQL(this, mysqlLib);
        },
        didDeployMessage: function (context) {
          var revisionKey = context.revisionData && context.revisionData.revisionKey;
          var activatedRevisionKey = context.revisionData && context.revisionData.activatedRevisionKey;

          if (revisionKey && !activatedRevisionKey) {
            return "Deployed but did not activate revision `" + revisionKey + "`. " +
              "To activate, run: ember deploy:activate " + context.deployTarget + " --revision=" + revisionKey + "\n";
          }
        }
      },

      requiredConfig: ['database', 'user', 'password'],

      configure: function (/* context */) {
        this.log('validating config', { verbose: true });

        var properties = [
          'distDir',
          'filePattern',
          'tableName',
          'revisionKey',
          'didDeployMessage',
          'deployClient',
          'maxRecentUploads'
        ];

        if (!this.pluginConfig.url) {
          properties.push('host');
          properties.push('port');
        }

        properties.forEach(this.applyDefaultConfigProperty.bind(this));

        this.log('config ok', { verbose: true });
      },

      upload: function (/* context */) {
        var deployClient = this.readConfig('deployClient');
        var tableName = this.readConfig('tableName');
        var revisionKey = this.readConfig('revisionKey');
        var distDir = this.readConfig('distDir');
        var filePattern = this.readConfig('filePattern');
        var filePath = path.join(distDir, filePattern);

        this.log('Uploading `' + filePath + '`', { verbose: true });
        return this._readFileContents(filePath)
          .then(deployClient.upload.bind(deployClient, tableName, revisionKey))
          .then(this._uploadSuccessMessage.bind(this))
          .then(function (args) {
            return {
              tableName: args[0],
              revisionKey: args[1]
            };
          })
          .catch(this._errorMessage.bind(this));
      },

      willActivate: function (/* context */) {
        var deployClient = this.readConfig('deployClient');
        var tableName = this.readConfig('tableName');

        var revisionKey = deployClient.activeRevisionKey(tableName);

        return {
          revisionData: {
            previousRevisionKey: revisionKey
          }
        };
      },

      activate: function (/* context */) {
        var deployClient = this.readConfig('deployClient');
        var revisionKey = this.readConfig('revisionKey');
        var tableName = this.readConfig('tableName');

        this.log('Activating revision `' + revisionKey + '`', { verbose: true });
        return Promise.resolve(deployClient.activate(tableName, revisionKey))
          .then(this.log.bind(this, '✔ Activated revision `' + revisionKey + '`', {}))
          .then(function () {
            return {
              revisionData: {
                activatedRevisionKey: revisionKey
              }
            };
          })
          .catch(this._errorMessage.bind(this));
      },

      didDeploy: function (/* context */){
        var didDeployMessage = this.readConfig('didDeployMessage');
        if (didDeployMessage) {
          this.log(didDeployMessage);
        }
      },

      fetchRevisions: function (/* context */) {
        var deployClient = this.readConfig('deployClient');
        var tableName = this.readConfig('tableName');

        this.log('Listing revisions in table: `' + tableName + '`');
        return Promise.resolve(deployClient.fetchRevisions(tableName))
          .then(function (revisions) {
            return {
              revisions: revisions
            };
          })
          .catch(this._errorMessage.bind(this));
      },

      _readFileContents: function (path) {
        return readFile(path)
          .then(function (buffer) {
            return buffer.toString();
          });
      },

      _uploadSuccessMessage: function (args) {
        this.log('Uploaded to table `' + args[0] +
          '` with key `' + args[1] + '`', { verbose: true });
        return Promise.resolve(args);
      },

      _errorMessage: function (error) {
        this.log(error, { color: 'red' });
        return Promise.reject(error);
      }
    });

    return new DeployPlugin();
  }
};
