# Scout Universal Compatibility Architecture

Scout's mission is to make the full computing stack approachable without limiting how far a developer can go.

> Easy things stay easy. Powerful things remain possible. Dangerous things are explicit.
>
> Interop before reinvention.

## Canonical file types

- `.scout` — Scout programming language source.
- `.sdata` — Scout's human-friendly JSON-compatible data/configuration format.

## Universal construction goal

Scout is being designed so developers can build web applications, servers, CLIs, desktop applications, mobile applications, AI systems, native tools, WebAssembly modules, systems software, embedded software, robotics software, and accelerator-backed workloads from one language family.

The language does not need to reimplement every useful library before it becomes useful. If an exceptional capability already exists in C, C++, Rust, Python, JavaScript, Java, Kotlin, Swift, Objective-C, WebAssembly, CUDA, Metal, or an operating-system SDK, Scout should provide a principled bridge to it.

## Raw FFI

Raw FFI (Foreign Function Interface) is Scout's lowest-level interoperability boundary. It allows Scout to call functions compiled outside Scout using an ABI such as the C ABI.

Conceptual syntax:

```scout
extern "C" from "sqlite3" {
  fn sqlite3_open(path: *const u8, db: *mut Ptr) -> i32
}
```

Raw FFI is intentionally explicit because pointers, ownership, calling conventions, alignment, lifetimes, callbacks, and foreign error conventions can be unsafe. Ordinary Scout applications should prefer safe generated wrappers. Raw FFI exists so systems programmers are never trapped by the high-level runtime.

## Scout Bridge

Scout Bridge is the interoperability subsystem. Its responsibilities include:

- ABI and runtime discovery;
- type mapping;
- calling-convention handling;
- ownership and lifetime boundaries;
- callbacks;
- async/promise/future conversion;
- exception/error conversion;
- foreign-object handles;
- buffer and zero-copy exchange where safe;
- generated bindings;
- package/runtime discovery;
- target compatibility validation.

The initial bridge registry describes C, C++, Rust, Python, JavaScript, Java, Kotlin, Objective-C, Swift, WebAssembly, native OS libraries, CUDA, and Metal.

## Interoperability type model

Scout's canonical bridge vocabulary includes fixed-width integer and floating-point types, booleans, characters, UTF-8 strings, C strings, byte buffers, lists, maps, structs, tuples, raw pointers, foreign handles, borrowed references, and owned foreign values.

A bridge must make ownership explicit rather than guessing. A foreign runtime may own a value while Scout merely holds a handle. A native buffer may be borrowed for a bounded call. An owned result must have one unambiguous destruction policy.

## Dependency ecosystems

Scout supports npm, pnpm, and Yarn as first-class JavaScript package-manager compatibility layers.

Canonical project creation commands:

```bash
npx create-scout-app@latest --template blank
pnpm create scout-app@latest --template blank
yarn create scout-app --template blank
```

The long-term dependency model is ecosystem-qualified:

```text
scout:<package>
npm:<package>
python:<package>
cargo:<crate>
jvm:<coordinate>
native:<library>
```

`scout install` should eventually orchestrate these ecosystems while preserving their native lockfiles and a Scout-level reproducibility record.

## Target profiles

Scout target profiles define what a build environment is allowed to assume. Initial profiles are:

- `web`
- `node`
- `linux-x64`
- `linux-arm64`
- `windows-x64`
- `macos-x64`
- `macos-arm64`
- `ios`
- `android`
- `wasm`
- `embedded`

A target profile declares output forms, capabilities, and compatible bridges. This prevents a dependency that only works on a JVM or native desktop runtime from silently appearing compatible with a browser or bare embedded target.

## Capability discovery

`scout capabilities` detects local runtimes, compilers, package managers, and accelerator toolchains.

`scout doctor` summarizes whether the local machine can currently support JavaScript, Python, native C/C++, Rust, Java/JVM, Swift, CUDA, npm, pnpm, and Yarn workflows.

The capability system is intended to grow into target-aware diagnostics for Android SDKs, Apple SDKs, WebAssembly toolchains, GPU backends, embedded toolchains, signing identities, and cloud build credentials.

## AI

Scout AI should be usable from beginner inference to high-performance model systems. The intended stack includes tensors, numerical kernels, autograd, neural-network primitives, data pipelines, model loading/export, inference, agents, vision, audio, NLP, vector search, distributed execution, and accelerator backends.

Python interoperability is strategically important so Scout developers can use existing AI ecosystems while Scout-native tensor and model infrastructure matures. Native C/C++/CUDA/Metal access prevents Python from becoming a mandatory execution dependency for performance-critical Scout AI workloads.

## Build platform

Scout's toolchain is intended to grow from local language tooling into an Expo/EAS-style application platform:

```text
scout dev
scout run
scout build
scout test
scout deploy
scout update
scout publish
scout build ios
scout build android
scout build web
scout build windows
scout build macos
scout build linux
```

Cloud build should eventually reproduce builds, provision target toolchains, sign supported application artifacts, package them, and return traceable artifacts.

## Education

Scout should teach transferable computer-science concepts rather than proprietary mental models. A developer who learns values, types, functions, control flow, collections, modules, errors, memory, concurrency, data structures, algorithms, I/O, networking, testing, compilation, and systems boundaries in Scout should find those concepts recognizable in Python, JavaScript, C, Rust, Java, and other languages.

The long-term `scout learn` experience should compare concepts across languages and help a learner move from beginner programming to application development, AI, and systems work without requiring a different language at every depth.

## Non-negotiable design laws

1. Easy things stay easy.
2. Powerful things remain possible.
3. Dangerous things are explicit.
4. Interop before reinvention.
5. Native capability must remain reachable.
6. Foreign ownership must never be guessed.
7. Unsupported target/dependency combinations must fail clearly.
8. Scout should not require users to abandon exceptional existing libraries.
9. High-level ergonomics must not permanently block low-level control.
10. One language should support a path from beginner to systems engineer.
