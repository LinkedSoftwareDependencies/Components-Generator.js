# Changelog
All notable changes to this project will be documented in this file.

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
