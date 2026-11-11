# Especificacao - Document Management System

## 1. Objetivo

Permitir que usuarios enviem, consultem e baixem seus documentos, mantendo os arquivos no filesystem local da aplicacao e os metadados em memoria.

## 2. Escopo

### Dentro do escopo

- Envio de um documento por requisicao.
- Listagem dos documentos associados ao usuario da requisicao.
- Download de um documento pelo identificador, somente pelo usuario associado.
- Armazenamento dos arquivos em `backend/storage` com `multer` e `diskStorage`.
- Armazenamento dos metadados em memoria durante a execucao do processo.
- Interface web para envio, listagem e download, consumindo a API pelo prefixo `/api` configurado no proxy do Vite.

### Fora do escopo

- Armazenamento em nuvem, banco de dados ou provedores externos.
- Persistencia dos metadados entre reinicializacoes do processo.
- Autenticacao, cadastro de usuarios e gerenciamento de credenciais.
- Versionamento, edicao ou exclusao de documentos.
- Compartilhamento de documentos entre usuarios.
- Conversao, visualizacao ou processamento do conteudo dos arquivos.

## 3. Requisitos funcionais

| ID | Requisito | Criterio de aceite |
| --- | --- | --- |
| RF-01 | O usuario pode enviar um arquivo usando `multipart/form-data` no campo `file`. | Uma requisicao valida cria um documento e retorna seus metadados com HTTP 201. |
| RF-02 | O sistema associa cada documento a um usuario identificado pela requisicao. | O campo `owner` dos metadados corresponde ao valor confiavel de `X-User-Id`. |
| RF-03 | O sistema valida a presenca do usuario e de um unico arquivo nao vazio. | Requisicoes sem identidade ou arquivo valido retornam erro de cliente sem criar metadados. |
| RF-04 | O sistema rejeita arquivos acima do limite configurado. | O limite e aplicado durante o upload e excede-lo retorna HTTP 413. |
| RF-05 | O usuario pode listar seus documentos. | A listagem inclui somente documentos cujo `owner` corresponde a identidade da requisicao, ordenados do mais recente para o mais antigo. |
| RF-06 | O usuario pode baixar um documento pelo identificador. | O arquivo e entregue como anexo somente quando pertence ao usuario da requisicao. |
| RF-07 | O sistema nao revela a existencia de documentos de outros usuarios. | Documento inexistente ou pertencente a outro usuario resulta em HTTP 404. |
| RF-08 | O sistema remove o arquivo local se nao conseguir concluir o registro dos metadados do upload. | Uma falha entre gravar o arquivo e registrar os metadados nao deixa um arquivo parcial ou sem referencia quando a remocao for possivel. |

## 4. Requisitos nao funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os arquivos devem ser gravados localmente em `backend/storage`, usando `multer` com `diskStorage`; nao usar servicos ou provedores externos. |
| RNF-02 | Os metadados devem permanecer em memoria nesta fase. Reiniciar o processo pode tornar os metadados indisponiveis mesmo que os arquivos continuem no disco. |
| RNF-03 | A porta e o limite maximo de upload devem ser configuraveis por variaveis de ambiente, com valores padrao documentados. |
| RNF-04 | O nome recebido do cliente nao pode ser usado como caminho ou nome fisico do arquivo. O nome interno deve ser gerado pela aplicacao. |
| RNF-05 | Respostas de erro nao devem expor caminhos locais, stack traces ou detalhes internos. |
| RNF-06 | A API deve usar JSON para respostas de sucesso de metadados e para erros, exceto o corpo binario do download. |
| RNF-07 | A identidade `X-User-Id` e uma premissa de confianca, nao um mecanismo de autenticacao. A API nao deve ser exposta a clientes nao confiaveis sem uma camada de autenticacao que defina essa identidade. |
| RNF-08 | A aplicacao pressupoe um unico processo local. O filesystem e os metadados em memoria nao oferecem compartilhamento entre replicas. |

### Configuracao

| Variavel | Padrao | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP do backend. |
| `UPLOAD_MAX_FILE_SIZE_BYTES` | `10485760` (10 MiB) | Tamanho maximo permitido para um arquivo. |

O diretorio de armazenamento desta fase e fixo em `backend/storage`; nao deve ser substituido por um caminho de provedor externo.

## 5. Modelo de dados

### Metadados publicos do documento

| Campo | Tipo | Descricao |
| --- | --- | --- |
| `id` | string | Identificador unico gerado pela aplicacao, preferencialmente UUID. |
| `originalName` | string | Nome original enviado pelo cliente, tratado como dado e nunca como caminho. |
| `size` | number | Tamanho do arquivo em bytes, inteiro nao negativo. |
| `uploadedAt` | string | Data e hora do upload em ISO 8601, UTC. |
| `owner` | string | Identificador do usuario confiavel associado ao documento. |

### Registro interno de persistencia

O repositorio pode manter, junto aos metadados publicos, um campo interno como `storageName` para localizar o arquivo gerado no disco. Esse campo nao deve ser devolvido pela API. Os registros ficam em uma estrutura em memoria indexada por `id`; nao ha garantia de persistencia apos reiniciar o processo.

## 6. Contratos de API

### Convencoes

- As rotas do backend sao `/upload`, `/documents` e `/documents/:id/download`.
- O frontend acessa essas rotas pelo prefixo `/api`, encaminhado pelo proxy do Vite. O prefixo nao precisa fazer parte das rotas internas do Express.
- Operacoes de usuario exigem `X-User-Id`, preenchido por uma origem confiavel. O valor deve ser nao vazio e tratado como identificador opaco.
- Tipos de arquivo nao sao restringidos nesta fase; o limite de tamanho e obrigatorio.
- Formato comum de erro: `{ "error": { "code": "CODIGO", "message": "Descricao" } }`.

### `POST /upload`

- **Entrada:** `multipart/form-data`, exatamente um arquivo no campo `file`; cabecalho `X-User-Id` obrigatorio.
- **Sucesso:** HTTP 201, `Content-Type: application/json`.

```json
{
  "document": {
    "id": "uuid",
    "originalName": "relatorio.pdf",
    "size": 2048,
    "uploadedAt": "2026-11-11T12:00:00.000Z",
    "owner": "usuario-123"
  }
}
```

- **Erros:** HTTP 400 para identidade, campo ou arquivo ausente/invalido; HTTP 413 para arquivo maior que o limite; HTTP 500 para falha inesperada de armazenamento ou persistencia de metadados.

### `GET /documents`

- **Entrada:** cabecalho `X-User-Id` obrigatorio.
- **Sucesso:** HTTP 200, documentos do usuario em ordem decrescente de `uploadedAt`; lista vazia quando nao houver documentos.

```json
{
  "documents": [
    {
      "id": "uuid",
      "originalName": "relatorio.pdf",
      "size": 2048,
      "uploadedAt": "2026-11-11T12:00:00.000Z",
      "owner": "usuario-123"
    }
  ]
}
```

- **Erros:** HTTP 400 se `X-User-Id` estiver ausente ou vazio; HTTP 500 para falha inesperada.

### `GET /documents/:id/download`

- **Entrada:** identificador do documento na rota e cabecalho `X-User-Id` obrigatorio.
- **Sucesso:** HTTP 200 com o conteudo binario, `Content-Type: application/octet-stream` e `Content-Disposition: attachment` usando o nome original tratado com seguranca.
- **Erros:** HTTP 400 se a identidade estiver ausente ou vazia; HTTP 404 se o documento nao existir, nao pertencer ao usuario ou se o arquivo nao estiver disponivel; HTTP 500 para falha inesperada de leitura.

## 7. Decisoes arquiteturais

- Backend em Node.js, Express e CommonJS, organizado em `routes/`, `controllers/`, `services/` e `repositories/`.
- Fluxo de dependencias: `routes -> controllers -> services -> repositories`. Camadas internas nao dependem de Express ou de detalhes do frontend.
- `routes/` declara endpoints e conecta middlewares e controllers. O middleware de upload configura o `multer` com `diskStorage` e os limites definidos.
- `controllers/` interpreta requisicoes, valida requisitos HTTP basicos e converte resultados ou erros em respostas HTTP.
- `services/` concentra regras de negocio: ownership, validacao de operacoes e coordenacao entre arquivo e metadados.
- `repositories/` encapsula leitura e escrita no filesystem local e acesso aos metadados em memoria.
- Frontend em React, organizado em componentes, paginas e servicos; requisicoes feitas com `fetch` pelo prefixo `/api`.
- O identificador de usuario e fornecido por infraestrutura confiavel. Nao implementar cadastro ou autenticacao como parte desta fase.
- Uploads usam nome fisico gerado pela aplicacao, sem confiar em caminhos ou nomes recebidos do cliente.
- Se o processo reiniciar, os metadados em memoria podem ser perdidos. A recuperacao, indexacao ou limpeza automatica de arquivos sem metadados fica fora do escopo.

## 8. Plano de execucao

O Passo 2 do exercicio ainda nao foi liberado. Portanto, este plano cobre somente o Passo 1 e nao antecipa etapas de implementacao.

1. Consolidar os requisitos funcionais e nao funcionais, o modelo de dados, os contratos de API e as decisoes arquiteturais neste documento, para revisao antes de qualquer implementacao.