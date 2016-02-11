# ember-cli-deploy-mysql

> Deploy your Ember.js index to MySQL

[![npm version](https://badge.fury.io/js/ember-cli-deploy-mysql.svg)](https://badge.fury.io/js/ember-cli-deploy-mysql) [![](https://ember-cli-deploy.github.io/ember-cli-deploy-version-badges/plugins/ember-cli-deploy-mysql.svg)](http://ember-cli-deploy.github.io/ember-cli-deploy-version-badges/)

This plugin, lovingly cribbed from [ember-cli-deploy-redis][8], uploads the
contents of a file, presumably index.html, to a specified MySQL table.  Systems
compatible with the MySQL protocol such as MariaDB are also supported.

More often than not this plugin will be used in conjunction with the [lightning
method of deployment][1] where the Ember.js application assets will be served
from S3 and the index.html file will be served from a key-value store of some
kind; in this case, a MySQL table.  However, it can be used to upload the
contents of any file.

## What is an ember-cli-deploy plugin?

A plugin is an addon that can be executed as a part of the ember-cli-deploy
pipeline. A plugin will implement one or more of the ember-cli-deploy's
pipeline hooks.

For more information on what plugins are and how they work, please refer to the
[Plugin Documentation][2].

## Why would I use this instead of ember-cli-deploy-redis?

That's a great question.  Redis is a much better solution for this kind of
problem and you can do neat things like serve directly from NGINX.  MySQL, on
the other hand, isn't really set up well for key-value storage and retrieval,
and it ends up being a somewhat clumsy solution.

In our case, we were only using Redis for this particular function, so it
seemed overkill to be running the service (and maintaining a connection pool to
it in our Ruby application).  Also, our API responses (including the Ember.js
index) are already being cached (thanks to a caching reverse proxy), so talk
about redundant layers!  It makes more sense for us, for now, to serve the
index from MySQL and let our reverse proxy cache it.  Perhaps your situation is
similar?

## Quick Start

To get up and running quickly, do the following:

- Ensure [ember-cli-deploy-build][4] is installed and configured.

- Install this plugin:

```sh
$ ember install ember-cli-deploy-mysql
```

- Place the following configuration into `config/deploy.js`:

```javascript
ENV.mysql = {
  user: '<your-mysql-user>',
  password: '<your-mysql-password>',
  database: '<your-mysql-database>'
}
```

- Run the pipeline:

```sh
$ ember deploy <environment>
```

## Installation

Run the following command in your terminal:

```sh
ember install ember-cli-deploy-mysql
```

## ember-cli-deploy Hooks Implemented

For detailed information on what plugin hooks are and how they work, please
refer to the [Plugin Documentation][2].

- `configure`
- `upload`
- `willActivate`
- `activate`
- `didDeploy`

## Configuration Options

For detailed information on how configuration of plugins works, please refer to
the [Plugin Documentation][2].

### host

The MySQL host. If [url](#url) is defined, then this option is not needed.

*Default:* `'localhost'`

### port

The MySQL port. If [url](#url) is defined, then this option is not needed.

*Default:* `3306` or `context.tunnel.srcPort` if present (set by
[ember-cli-deploy-ssh-tunnel][7])

### database

The MySQL database name. If [url](#url) is defined, then this option is not
needed.

### user

The MySQL user name. If [url](#url) is defined, then this option is not needed.

### password

The MySQL password. If [url](#url) is defined, then this option is not needed.

You can create a `.env.deploy.<environment>` file in your project root to store
"secrets" like database passwords (e.g. `MYSQL_PASSWORD=bananasplit`) and
reference these values in your `config/deploy.js` as `process.env.<key>` (e.g.
`process.env.MYSQL_PASSWORD`).  You should add any and all such "secret" files
to your `.gitignore` to prevent them from being inadvertently checked in!

### url

A MySQL connection URL:

*Example:* `'mysql://some-user:some-password@some-host/some-db'`

See the [node-mysql][3] documentation for more information.

### filePattern

A file matching this pattern will be uploaded to the MySQL table.

*Default:* `'index.html'`

### distDir

The root directory where the file matching `filePattern` will be searched for.
By default, this option will use the `distDir` property of the deployment
context.

*Default:* `context.distDir`

### tableName

The name of the table to be used to store the revision keys and file contents
in MySQL.  By default this option will use the `project.name()` property
from the deployment context.

*Default:* `context.project.name().replace(/-/g, '_') + '_bootstrap'`

The table is created in your database automatically on the initial deploy, so
your MySQL user will need create table privileges!  Here is the DDL in case you
want to create it separately, in advance:

```sql
CREATE TABLE `your_project_name_bootstrap` (
  `id` int AUTO_INCREMENT,
  `key` varchar(255) NOT NULL,
  `value` text NOT NULL,
  `gitsha` binary(20), -- reserved for future use
  `deployer` varchar(255), -- reserved for future use
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `NATURAL` (`key`)
);
```

Which should create a table that looks like:

| Field      | Type         | Null | Key | Default           | Extra          |
| ---------- | ------------ | ---- | --- | ----------------- | -------------- |
| id         | int(11)      | NO   | PRI | NULL              | auto_increment |
| key        | varchar(255) | NO   | UNI | NULL              |                |
| value      | text         | NO   |     | NULL              |                |
| gitsha     | binary(20)   | YES  |     | NULL              |                |
| deployer   | varchar(255) | YES  |     | NULL              |                |
| created_at | timestamp    | NO   |     | CURRENT_TIMESTAMP |                |

### revisionKey

The unique revision number for the version of the file being uploaded to MySQL.
By default this option will use either the `revisionKey` passed in from the
command line or the `revisionData.revisionKey` property from the deployment
context.

*Default:* `context.commandLineArgs.revisionKey || context.revisionData.revisionKey`

### allowOverwrite

A flag to specify whether the revision should be overwritten if it already
exists in the MySQL table.

*Default:* `false`

### deployClient

The MySQL client to be used to upload files to the MySQL table.  By default
this option will use a new instance of the [MySQL][3] client.  This allows for
injection of a mock client for testing purposes.

*Default:* `return new MySQL(options)`

### didDeployMessage

A message that will be displayed after the file has been successfully uploaded
to MySQL. By default this message will only display if the revision for
`revisionData.revisionKey` of the deployment context has been activated.

### maxRecentUploads

The maximum number of recent revisions to keep in the MySQL table.

*Default:* `10`

## Activation

As well as uploading a file to MySQL, *ember-cli-deploy-mysql* has the ability
to mark a revision of a deployed file as `current`.  This is most commonly used
in the [lightning method of deployment][1] whereby an index.html file is pushed
to a key-value store and then served to the user by the application.

The application could be configured to return any existing revision of the
index.html file as requested by a query parameter.  However, the revision
marked as the currently active revision would be returned if no query parameter
is present.  For more detailed information on this method of deployment please
refer to the [ember-cli-deploy-lightning-pack README][1].

### How do I activate a revision?

A user can activate a revision by either:

- Passing a command line argument to the `deploy` command:

```sh
$ ember deploy <environment> --activate
```

- Running the `deploy:activate` command:

```sh
$ ember deploy:activate <environment> --revision=<revision-key>
```

- Setting the `activateOnDeploy` flag in `config/deploy.js`

```javascript
ENV.pipeline = {
  activateOnDeploy: true
}
```

### What does activation do?

When *ember-cli-deploy-mysql* uploads a file to MySQL, it uploads to the table
defined by the `tableName` config property, with a key defined by the
`revisionKey` config property.  So if there have been three revisons deployed,
MySQL might look something like this:

```sh
$ mysql -u root foo

MariaDB [foo]> select `key`, left(`value`, 10) from bar_bootstrap;
+----------------------------------+-------------------+
| key                              | left(`value`, 10) |
+----------------------------------+-------------------+
| cc9d9af44ad70f4a6732c1c13deb246e | <!DOCTYPE         |
| 071be39412920947613c00d680b8e9c0 | <!DOCTYPE         |
| d56d56274aac91e229fa69f34f4cf81d | <!DOCTYPE         |
+----------------------------------+-------------------+
```

Activating a revison would add a new entry to the MySQL table pointing to the
selected revision:

```sh
$ ember deploy:activate production --revision=cc9d9af44ad70f4a6732c1c13deb246e
✔ Activated revision `cc9d9af44ad70f4a6732c1c13deb246e`
$ mysql -u root foo

MariaDB [foo]> select `key`, left(`value`, 10) from bar_bootstrap;
+----------------------------------+-------------------+
| key                              | left(`value`, 10) |
+----------------------------------+-------------------+
| cc9d9af44ad70f4a6732c1c13deb246e | <!DOCTYPE         |
| 071be39412920947613c00d680b8e9c0 | <!DOCTYPE         |
| d56d56274aac91e229fa69f34f4cf81d | <!DOCTYPE         |
| current                          | cc9d9af44a        |
+----------------------------------+-------------------+
```

### When does activation occur?

Activation occurs during the `activate` hook of the pipeline.  By default,
activation is turned off and must be explicitly enabled by one of the three
methods described above.

## What if my MySQL server isn't publicly accessible?

Not to worry!  Just install the handy-dandy [ember-cli-deploy-ssh-tunnel][7]
plugin:

```
ember install ember-cli-deploy-ssh-tunnel
```

And set up your `config/deploy.js` similar to the following:

```js
ENV = {
  mysql: {
    database: 'your-mysql-database',
    user: 'your-mysql-user',
    password: process.env.MYSQL_PASSWORD
  },
  'ssh-tunnel': {
    username: 'your-ssh-username',
    host: 'remote-mysql-host'
  }
}
```

### What if my MySQL server is only accessible *from* my remote server?

Sometimes you need to SSH into a server (a "bastion" server) and then run
`mysql` or similar from there.  This is really common if you're using RDS on
AWS, for instance.  We've got you covered there, too: just set your SSH
tunnel host to the bastion server and tell the tunnel to use your MySQL server
as the destination host, like so:

```js
ENV = {
  mysql: {
    database: 'your-mysql-database',
    user: 'your-mysql-user',
    password: process.env.MYSQL_PASSWORD
  },
  'ssh-tunnel': {
    username: 'your-ssh-username',
    host: 'remote-mysql-client',
    dstHost: 'remote-mysql-server'
  }
}
```

## Prerequisites

The following properties are expected to be present on the deployment `context`
object:

- `distDir` (provided by [ember-cli-deploy-build][4])
- `project.name()` (provided by [ember-cli-deploy][5])
- `revisionData.revisionKey` (provided by [ember-cli-deploy-revision-data][6])
- `commandLineArgs.revisionKey` (provided by [ember-cli-deploy][5])
- `deployEnvironment` (provided by [ember-cli-deploy][5])

The following properties are used if present on the deployment `context`
object:

- `tunnel.srcPort` (provided by [ember-cli-deploy-ssh-tunnel][7])

[1]: https://github.com/lukemelia/ember-cli-deploy-lightning-pack "ember-cli-deploy-lightning-pack"
[2]: http://ember-cli.github.io/ember-cli-deploy/plugins "Plugin Documentation"
[3]: https://github.com/felixge/node-mysql "MySQL client"
[4]: https://github.com/ember-cli-deploy/ember-cli-deploy-build "ember-cli-deploy-build"
[5]: https://github.com/ember-cli/ember-cli-deploy "ember-cli-deploy"
[6]: https://github.com/ember-cli-deploy/ember-cli-deploy-revision-data "ember-cli-deploy-revision-data"
[7]: https://github.com/ember-cli-deploy/ember-cli-deploy-ssh-tunnel "ember-cli-deploy-ssh-tunnel"
[8]: https://github.com/ember-cli-deploy/ember-cli-deploy-redis "ember-cli-deploy-redis"
