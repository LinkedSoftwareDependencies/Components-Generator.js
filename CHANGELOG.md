# Changelog
All notable changes to this project will be documented in this file.

<a name="v3.0.0-beta.1"></a>
## [v3.0.0-beta.1](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/compare/v3.0.0-beta.0...v3.0.0-beta.1) - 2021-12-02

### Added
* [Allow type aliases for interfaces and classes](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/c480f717ad35ec0e8c1cc67dbacf9e7eac69fd25)

<a name="v3.0.0-beta.0"></a>
## [v3.0.0-beta.0](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/compare/v2.6.0...v3.0.0-beta.0) - 2021-11-30

_Requires Components.js >= 5.0.0_

### BREAKING CHANGES
* [Enable type scoped context functionality by default](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/40bcc44c99674e467b7c3b0c9b9d6b0c563f283b): This means that the `--typeScopedContexts` CLI option should not be passed anymore.
* [Make component URLs dereferenceable](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/783670cc6ff91b5d33bb5431b7f817e73acd9548): This improves the URL strategy for components, and results in different component URLs.
* Align with Components.js range changes:
  * [Remove 'unique' field option in favor of array param type](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/8d60dcd0479b960857f87758bf02ddf6fdf44b47)
  * [Remove 'required' field option in favor of union with undefined](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/e65f0e8bc8f1ea0b05472e630cebb784fe2ea525)
  * [Explicitly serialize undefined parameter ranges](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/cb37fb5e82292e46eab76e96d364db25e2d21f67)
* [Set minimum Node version to 12](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/23bf2634dba4ec95955293f4e91545e340cea1eb)

### Added
* [Allow configuration using config file](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/bbdd36b0dd38a49151c467f46d3bd2014933b820)
    * [Allow package paths to be ignored](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/a6d47ce00ab8c3c5b0e70bcdc8cdf8f07e6c34d4)
* Improve TypeScript language support:
  * [Support components defined within namespaces via export assignment](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/d5582d2126138643f88cf0398218e1eb9883a227)
  * [Support imports for packages that have external @types packages](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/12996b70c2b2a3b82dbfe99dbceb943ea1294cf4)
  * [Support type literals and type aliases](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/ff2fdc103cb6a658ac1741322686832e8cc88d96)
  * [Generate param ranges with tuples and rest types](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/348b80dcbb47d5888cd1ac8a724bc848209e16c1)
  * [Generate param ranges with union and intersection types](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/7796c816295886a4702e8037f441fac9559891a6)
* Improve tag support:
  * [Allow multiple @default values to be defined](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/6b0177210f7608b0d284da87cf40d432c5c4132b)
  * [Fix @ symbols not being allowed in comment data](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/26e2f405db6d0cf6de5d3fd1e7d46681205e9e07)
  * [Allow setting default JSON values](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/61e0b13bfaced9e9c8b2c36f3c89d588cf76f9b2)
  * [Allow default IRI values to be relative](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/d400e1fc56aca4c52f194213a1090651604e8941)
  * [Allow defaultNested tags to be added with typed values](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/0ec8fa9d6cf470965c0ce6ce148f65cbf751916c)
  * [Keep structural param type information on overrides](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/b05cb60473ec839718c9a1fa3ac42ee670a21224)
  * [Allow default values to be IRIs when wrapped in <>](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/7275824082cb180c9abe5f4f8084b48c4ee5e98f)
* [Add shorter param entries in type-scoped context when possible.](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/3b21fb75448cac9288045ca12f330040cefa2a08)
* [Enable generation of multiple packages in bulk](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/86467d2b43dd1006aff937644afa51f7cdcb522d): This allows this generator to be used in monorepos
* [Add option to dump debug state](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/ae0b5278bb9d93f513f70fb5731d727817b46d97)
* [Allow constructor comment data inheritance from supers](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/3527ceb4d8f8e0d259dffba0dacc393b011cd4c1)
* [Allow interface args to extend from other interfaces, Closes #73](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/b5724be7b30fb3d6a57f25bbe4e3fc534c9db4f5)
* [Also consider recursive deps when loading external modules](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/a6596e0b87600359be7b6daa04adda25066fc062)
* [Allow components from other packages to be re-exported](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/1ddb44afbf594973971829efcdcae7d1855950c8)

### Fixed
* [Fix default values not being in an RDF list when needed](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/e9761232748ea7bb1d2a6e58664011a6092ec092)
* [Fix @list not being applied on optional arrays](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/078f78c9ed2bc33e27344d28307df4fd776eca57)
* [Fix crash when loading fields from super interface chains](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/3de032af5adef3a2a2c1bfcf1a350d4306be38b7)

### Changed
* [Reduce unneeded logging](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/75ff04cb1f040e7e25bc1d3486bb946e0c37d364)
* [Ignore imports that fail](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/f73798f6b9bcd8d9d2ba35d9963d2869a783e8b0)
* [Allow components to be part of multiple modules](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/32350fa72830892adf27304619fad1b64e8b2eae)
* [Fix param range resources using @type instead of @id](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/1fbad2f8f91c91ce0528b85df690a1356fbd6ed0)

<a name="v2.6.1"></a>
## [v2.6.1](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/compare/v2.6.0...v2.6.1) - 2021-09-29

### Fixed
* [Fix optional types not always being parsed correctly, Closes #74](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/c95294a929452faed872838d5e8bbd2bcde13e3d)

<a name="v2.6.0"></a>
## [v2.6.0](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/compare/v2.5.0...v2.6.0) - 2021-07-20

### Added
* [Add CLI parameter to set prefix of package](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/a2b51b0af99f42b8d6e80496afc661c8550cef31)

<a name="v2.5.0"></a>
## [v2.5.0](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/compare/v2.4.0...v2.5.0) - 2021-06-30

### Added
* [Mark array properties as RDF list (support for empty arrays)](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/8527ca04877e0e97333c457b4e9b783252810068)
* [Strip away unsupported types in constructor arguments](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/2b1fbe9d915ebf447f7a04c576c8a110b381c97d)
* [Support keywords like 'public' in constructor args](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/ba8f743809cd1bf61dab16edac5fb6e95f384419)

<a name="v2.4.0"></a>
## [v2.4.0](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/compare/v2.3.0...v2.4.0) - 2021-06-14

### Added
* [Interpret @range {json} as rdf:JSON params](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/09f7a378c2c8c6471c706fb7bdcee5d59535ec57)

<a name="v2.3.0"></a>
## [v2.3.0](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/compare/v2.2.0...v2.3.0) - 2021-06-08

### Added
* [Generate interface-based components](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/aba0aa12900253a687be9b37d1c61da8a2bbaf4b)

<a name="v2.2.0"></a>
## [v2.2.0](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/compare/v2.1.0...v2.2.0) - 2021-05-19

### Added
* [Allow components from third-party packages to be used, Closes #39](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/3676b8a46d4e876ca4c7e4bba5a4ecbabbf2a5b2)

<a name="v2.1.0"></a>
## [v2.1.0](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/compare/v2.0.0...v2.1.0) - 2021-01-18

### Added
* [Add experimental typeScopedContexts flag](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/9e181fcf7edb01909be9f23920fae4ee01a3cba2)

### Fixed
* [Fix build error when source or target path occurs 1+ times in path](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/379d9aa2c6219d5a43e91e48182e9cb2aa395c14)

<a name="v2.0.0"></a>
## [v2.0.0](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/compare/v1.6.0...v2.0.0) - 2021-01-14

### Added
* [Use prefetched document loader for offline context access, Closes #51](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/be759e9ce878d0794cc40985f8d1268be06ec44b)
* [Add support for lsd:module true in package.json](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/9e674d2175528eb9b1ad98a41e2b63292b0759ea)

### Changed
* [Update context shortcuts to support JSON-LD 1.1](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/0eb3fc7f37e011c1ac8c4397e012c368f6260499)
* [Update to Components.js context version 4](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/d6416ece7150022af3f1b633c9229313d59484a5)

### Fixed
* [Fix file prefixing always using 1.0.0, Closes #52](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/fde91046d482a29331a08df6dc79df7fe436441d)

<a name="v1.6.0"></a>
## [v1.6.0](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/compare/v1.5.0...v1.6.0) - 2020-11-24

### Added
* [Allow param range to be undefined when its class range is ignored](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/ec8fca3e0738bf5a1df7d7bcf75de96cdb90816c)

<a name="v1.5.0"></a>
## [v1.5.0](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/compare/v1.4.1...v1.5.0) - 2020-11-23

### Added
* [Allow classes to be ignored via JSON file, Closes #40](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/ea1028b474e7a697dbf222e5b27ae9ba49f8a7f5)

### Changed
* [Set tsconfig target to es2017](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/43ad90ff0169f05ea77cadf17fd946bcf3c0bfb2)

<a name="v1.4.1"></a>
## [v1.4.1](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/compare/v1.4.0...v1.4.1) - 2020-11-09

### Fixed
* [Fix collectEntries params being required and unique](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/93c3b42e2ad4600f8180a3efc63df2a1e9a4f9f9)
* [Fix indexed field names appearing twice in IRIs](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/5abbcf2fbb9404a138fff7b319b864af705213e9)

<a name="v1.4.0"></a>
## [v1.4.0](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/compare/v1.3.0...v1.4.0) - 2020-11-06

### Added
* [Translate Record type aliases into hashes, Closes #47](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/0543b660c53cdfe5bbe7727f1a6d62db77e56c6d)

### Changed
* [Be less strict in how typings are defined in package.json](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/76f9929d0b19faeb317ebf457a4d7eb9e3510d48)

<a name="v1.3.0"></a>
## [v1.3.0](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/compare/v1.2.0...v1.3.0) - 2020-11-02

### Changed
* [Fix incorrect package name, Closes #45](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/6bab91afe3e088340f9bc46a16ee3dc25e3b4972)
* [Use 'types' property to detect index.d.ts file](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/a09876ba817f576a97da76f4209259dcbfb6161b)
* [Ensure unique field names within a class, Closes #44](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/7c14d2a1aa840dc6dcf226a5ae16022b4b0b1363)

<a name="v1.2.0"></a>
## [v1.2.0](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/compare/v1.1.0...v1.2.0) - 2020-10-27

### Added
* [Handle indexed hashes as collectEntries parameters, Closes #43](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/9848655ead5b52dbf0b18cf732509363c1468de9)

<a name="v1.1.0"></a>
## [v1.1.0](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/compare/v1.0.1...v1.1.0) - 2020-09-07

### Added
* [Handle generically typed parameters](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/3344ea9ff1d023a9a14efaac330d79097ac444d9)

### Fixed
* [Fix exiting with code 0 on error](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/157a9f5f52f16eb4b1f8a943b4111ef4f7923353)

<a name="v1.0.1"></a>
## [v1.0.1](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/compare/v1.0.0...v1.0.1) - 2020-08-28

### Fixed
* [Make library path handling OS independent](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/commit/0415100bcca41d8f90717b5762bbc057b0c80b3e)

<a name="v1.0.0"></a>
## [v1.0.0] - 2020-08-27

Initial release
