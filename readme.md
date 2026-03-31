# Notepade Tuned

MVP de um editor desktop para Windows com `Tauri + React`, pensado como um Notepad melhorado:

- escrita livre em uma area editavel
- colagem de imagens com `Ctrl+V`
- abertura e salvamento de arquivos `.txt`
- reabertura do conteudo salvo, incluindo imagens embutidas no proprio `.txt`

## Como o `.txt` funciona

O arquivo salvo continua sendo texto puro, mas as imagens entram serializadas como `data URL` dentro de marcadores:

```txt
Texto normal da nota.
[[notepade:image:data:image/png;base64,...]]
Mais texto abaixo.
```

Isso permite:

- manter compatibilidade com a exigencia de salvar como `.txt`
- reabrir o mesmo arquivo no app sem perder as imagens
- manter um formato simples e sem banco de dados

## Estrutura

- `src/`: frontend React
- `src-tauri/`: app desktop Tauri para Windows

## Rodar localmente

### 1. Instalar dependencias JS

```bash
npm install
```

### 2. Instalar Rust

Tauri precisa de toolchain Rust no Windows. No estado atual da maquina, `cargo` e `rustc` nao estao instalados.

Instale com:

```bash
winget install Rustlang.Rustup
```

Depois feche e abra o terminal, e confirme:

```bash
rustc -V
cargo -V
```

### 3. Rodar em desenvolvimento

```bash
npm run tauri:dev
```

### 4. Gerar executavel Windows

```bash
npm run tauri:build
```

## Proximos passos recomendados

- adicionar atalhos de teclado tipo Notepad (`Ctrl+N`, `Ctrl+O`, `Ctrl+S`)
- permitir arrastar imagens para dentro do editor
- adicionar exportacao para `.md` ou `.html`
- incluir associacao de arquivos no instalador Windows
