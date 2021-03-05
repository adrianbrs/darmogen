# Darmogen ![https://www.npmjs.com/package/@adrianbrs/darmogen](https://img.shields.io/npm/v/@adrianbrs/darmogen)

## Generate Dart models from TypeORM entities

```bash
.-,--.
' |   \ ,-. ,-. ,-,-. ,-. ,-. ,-. ,-.
, |   / ,-| |   | | | | | | | |-' | |
`-^--'  `-^ '   ' ' ' `-' `-| `-' ' '
                           ,|  v1.0.0
                           `'

■ Source: "/home/adrian/Projetos/NestProject/src"
× Target: "/home/adrian/Projetos/DartProject/lib/modules/api"

┌ Found 13 files:
├ Parsing    |========================================| 100% | 7/7 parsed files | (User)
├ Generating |========================================| 100% | 7/7 generated files | (User)
│
│─────────────────────────────────────────────────────────────────────────────────────┐
│ Generated 7 models:                                                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
├ » Ban (../DartProject/lib/modules/api/ban/ban.model.dart)                           │
├ » Friendship (../DartProject/lib/modules/api/friendship/friendship.model.dart)      │
├ » GlobalRole (../DartProject/lib/modules/api/global-roles/global-role.model.dart)   │
├ » OAuthClient (../DartProject/lib/modules/api/oauth/oauth-client.model.dart)        │
├ » RevokedToken (../DartProject/lib/modules/api/oauth/revoked-token.model.dart)      │
├ » Role (../DartProject/lib/modules/api/roles/role.model.dart)                       │
├ » User (../DartProject/lib/modules/api/user/user.model.dart)                        │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

<br/>

## Installation

```bash
yarn add -D @adrianbrs/darmogen
# or
npm install @adrianbrs/darmogen --save-dev
```

## Usage

1. Create `darmogen.js` file in the project root with Darmogen options.
2. Execute `yarn darmogen` or `npx darmogen` to generate models on the output path.

## Examples

### Options file example

darmogen.js

```js
const { kebab } = require("@adrianbrs/darmogen");

module.exports = {
  parser: {
    aliases: {
      src: "{cwd}",
    },
    cwd: "./src",
    root: "../",
    ext: ".entity.ts",
  },
  generator: {
    out: "/home/adrian/Projetos/DartProject/lib/modules/api",
    imports: ["model-base.dart"],
    formatters: {
      name: (name) => name,
      filename: (name) => kebab(name).toLowerCase() + ".model.dart",
    },
  },
};
```

### Model output example

user.model.dart

```dart
import '../model-base.dart';
import '../global-roles/global-role.model.dart';
import '../roles/role.model.dart';
import '../friendship/friendship.model.dart';

class User extends Model {
  String name;
  String email;
  String username;
  String avatar;
  List<Role> roles;
  List<Friendship> sentFriendships;
  List<Friendship> receivedFriendships;
  dynamic status;
  GlobalRole globalRole;
  DateTime lastLoginDate;
  String id;
  DateTime createdAt;
  DateTime updatedAt;

  User(
      {String id,
      this.name,
      this.email,
      this.username,
      this.avatar,
      this.roles,
      this.sentFriendships,
      this.receivedFriendships,
      this.status,
      this.globalRole,
      this.lastLoginDate,
      this.createdAt,
      this.updatedAt})
      : super(id);

  @override
  Map<String, dynamic> toJson() => {
        'name': name,
        'email': email,
        'username': username,
        'avatar': avatar,
        'roles': roles?.map((role) => role.toJson())?.toList(),
        'sentFriendships':
            sentFriendships?.map((friendship) => friendship.toJson())?.toList(),
        'receivedFriendships': receivedFriendships
            ?.map((friendship) => friendship.toJson())
            ?.toList(),
        'status': status,
        'globalRole': globalRole?.toJson(),
        'lastLoginDate': lastLoginDate?.toIso8601String(),
        'id': id,
        'createdAt': createdAt?.toIso8601String(),
        'updatedAt': updatedAt?.toIso8601String(),
      };

  factory User.fromJson(Map<String, dynamic> json) {
    if (json == null) return null;
    return User(
        name: json['name'],
        email: json['email'],
        username: json['username'],
        avatar: json['avatar'],
        roles: (json['roles'] as List<dynamic>)
            ?.map((data) => Role.fromJson(data)),
        sentFriendships: (json['sentFriendships'] as List<dynamic>)
            ?.map((data) => Friendship.fromJson(data)),
        receivedFriendships: (json['receivedFriendships'] as List<dynamic>)
            ?.map((data) => Friendship.fromJson(data)),
        status: json['status'],
        globalRole: GlobalRole.fromJson(json['globalRole']),
        lastLoginDate: DateTime.tryParse(json['lastLoginDate'] ?? ''),
        id: json['id'],
        createdAt: DateTime.tryParse(json['createdAt'] ?? ''),
        updatedAt: DateTime.tryParse(json['updatedAt'] ?? ''));
  }
}

```

### Model base example

model-base.dart

```dart
import 'dart:convert';

var jsonEncoder = JsonEncoder.withIndent('  ');

abstract class Model {
  String id;

  Model(this.id);

  Map<String, dynamic> toJson();

  String toString() {
    return "$runtimeType ${jsonEncoder.convert(this.toJson())}";
  }
}

```

## Available options

| Option               | Type     | Required | Description                                                                                                                                      |
| -------------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| parser.aliases       | Object   | yes      | Aliases when resolving entity imports. `{alias: "path", ...}`                                                                                    |
| parser.cwd           | string   | yes      | Folder to search for entities                                                                                                                    |
| parser.root          | string   | yes      | Root project path, with node_modules                                                                                                             |
| parser.ext           | string   | no       | Entity file extension                                                                                                                            |
| generator.out        | string   | yes      | Output Dart models folder                                                                                                                        |
| generator.imports    | string[] | no       | Manual Dart imports **relative to** output folder                                                                                                |
| generator.formatters | Object   | no       | Object with functions, which are given a string and must return a string, to format class and file names. `{name: Function, filename: Function}` |

## Links

- [My GitHub](https://github.com/adrianbrs)
- [Issues](https://github.com/adrianbrs/darmogen/issues)
- [Send a Pull Request](https://github.com/adrianbrs/darmogen/pulls)
