# Scout Language Platform

Scout uses two canonical file families:

```text
.scout  Scout programming language
.sdata  Scout data/configuration format
```

Scout is designed around one progression: beginner-friendly syntax at the surface, native reach at the bottom, and interoperability throughout.

## Language goals

- easy to learn and read;
- compiled execution rather than depending on a slow interpreter as the performance ceiling;
- strong type inference with optional explicit types;
- no requirement for TypeScript-style annotation ceremony;
- automatic safe memory management for ordinary code;
- explicit arenas, regions, buffers, value types, and unsafe/native escape hatches for systems work;
- first-class async, concurrency, threads, atomics, SIMD, networking, filesystems, processes, and FFI;
- native and WebAssembly targets;
- strong JavaScript/Web interoperability;
- AI/tensor/accelerator capabilities;
- a single CLI, package workflow, formatter, test runner, language server, and build/deploy experience.

## Programming model direction

Simple Scout should remain readable:

```scout
name = "world"

fn greet(name) {
  print("Hello, ${name}!")
}

greet(name)
```

Performance- and systems-oriented Scout can become explicit when needed:

```scout
struct Vec3 {
  x: f32
  y: f32
  z: f32
}

fn dot(a: Vec3, b: Vec3) -> f32 {
  return a.x * b.x + a.y * b.y + a.z * b.z
}
```

Unsafe machine access is never implicit:

```scout
unsafe {
  // raw pointer, ABI, device, or memory-mapped operations
}
```

## Compiler architecture

```text
.scout source
  ↓
lexer/tokenizer
  ↓
parser
  ↓
AST
  ↓
semantic analysis + type inference
  ↓
Scout IR
  ↓
optimization
  ↓
backend selection
  ├─ native
  ├─ WebAssembly
  └─ platform runtime/bindings
```

The existing Scout tokenizer, lossless parser, recovery model, incremental editing, diagnostics, and LSP infrastructure are the editor/tooling foundation. The programming-language grammar and semantic compiler layers must be built separately from the `.sdata` JSON-compatible grammar rather than overloading one grammar with two meanings.

## Memory model direction

Ordinary Scout should not require manual `malloc`/`free` style management. The compiler/runtime may use stack allocation, value types, escape analysis, automatic heap ownership, reference counting or tracing where appropriate, and optimized pools/arenas for specialized workloads.

Systems programming keeps explicit escape hatches for raw pointers and foreign ownership. Unsafe behavior must be visible in source and restricted to deliberate boundaries.

## AI direction

Scout AI should support a progression from simple inference to native kernels:

```text
high-level model APIs
  ↓
tensors + data pipelines + autograd
  ↓
Scout tensor/AI IR
  ↓
CPU/SIMD/GPU kernels
  ├─ CUDA
  ├─ Metal
  └─ portable/native backends
```

Python interoperability lets developers use mature AI libraries early. Scout-native numerical and accelerator infrastructure can progressively remove foreign-runtime overhead where doing so provides real value.

## Application platform direction

Scout intends to support an Expo/EAS-like workflow while remaining broader than mobile:

```bash
npx create-scout-app@latest --template blank
scout dev
scout build
scout test
scout deploy
```

Templates can grow to include `blank`, `web`, `api`, `fullstack`, `desktop`, `mobile`, `ai`, `wasm`, `cli`, `library`, and `systems`.

The build platform should eventually support local and reproducible cloud builds for web, iOS, Android, Windows, macOS, Linux, and other qualified target profiles.

## Developer promise

Scout should not punish a developer for choosing it. Existing exceptional libraries remain reachable through Scout Bridge, while Scout-native libraries can become preferred when they provide better integration, safety, portability, or performance.
