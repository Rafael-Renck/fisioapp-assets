# FisioApp (protótipo de espaços individuais)

Execute `npm ci` e `npm run dev -- --hostname 0.0.0.0 --port 3000` nesta pasta. A página inicial abre no login. Somente no primeiro acesso do administrador, use o link para `/setup`. O servidor cria um código de instalação em `.data/setup-token` (ou em `$FISIOAPP_DATA_DIR/setup-token`). Leia esse arquivo no servidor e use o código para criar a sua conta de administrador. O arquivo é removido após a criação da conta e o link de configuração desaparece do login. Nunca envie o código nem senhas para o repositório.

O super administrador entra no FisioApp normal, com pacientes e agenda em seu próprio espaço. Em `/configuracoes`, cria o login de cada fisioterapeuta com e-mail e senha temporária. Cada profissional troca a senha ao entrar, configura seu perfil, locais, tipos de atendimento, convênios e horários e acessa apenas seus próprios pacientes e agenda. Suspender um espaço encerra suas sessões de acesso. O super administrador gerencia contas, mas não vê os dados clínicos dos outros espaços.

Em `/prontuarios`, o profissional busca um paciente e abre seu prontuário. A ficha reúne dados cadastrais, atendimentos, anamnese, evoluções e plano de tratamento. Cada evolução é um novo registro. Ao salvar novamente a anamnese ou o plano, a versão anterior permanece disponível. Pacientes arquivados podem ser consultados, mas não recebem novos registros clínicos. Os prontuários são armazenados no banco de dados, separados por espaço.

Na aba **Laudos**, o profissional registra finalidade, avaliação, achados, conclusão, orientações, nome e registro profissional. Cada laudo salvo fica no histórico sem substituir os anteriores; a página do documento pode ser impressa ou salva em PDF pelo navegador. A impressão inclui uma linha para assinatura manual e não aplica assinatura eletrônica.

Na agenda, cada atendimento de paciente ativo oferece a ação **Cadastrar evolução**, que abre o prontuário na aba Evoluções com a data da sessão. O formulário de agendamento carrega os tipos de atendimento e convênios do espaço em Configurações; o convênio escolhido fica registrado na sessão. O cadastro rápido de pacientes usa essas mesmas listas.

Para atendimentos de convênio, a agenda avisa quando falta o número da guia ou senha de autorização. Depois que a sessão é marcada como realizada, a equipe pode comparar a guia com o relatório de pagamento recebido em PDF e registrar **Conferido** ou **Divergente**, com o valor encontrado. Até essa ação, o pagamento aparece como **A conferir**. O relatório de atendimentos permite filtrar essas situações, buscar a guia, abrir a sessão e exportar os dados em CSV. A conferência é manual; o sistema ainda não lê o PDF nem confirma pagamentos por conta própria.

Nos contratos de doulagem, uma ou duas formas de pagamento podem dividir o valor total. O sinal é registrado com valor, forma e data como quantia já recebida, incluída no total; somente o saldo restante é distribuído entre as parcelas. Os contratos antigos continuam consultáveis com a forma de pagamento original.

Sem `SUPABASE_DATABASE_URL`, o sistema usa SQLite em `.data/fisioapp.sqlite` (ou em `$FISIOAPP_DATA_DIR/fisioapp.sqlite`). A primeira leitura importa automaticamente os JSON antigos de cada espaço e da plataforma, mantendo os arquivos originais intactos. A primeira gravação de cada dia cria uma cópia em `.data/backups/`; as 14 cópias diárias mais recentes são mantidas. Execute `npm run backup` para criar uma cópia extra verificada, inclusive antes de atualizar o sistema. Guarde também uma cópia fora do servidor; se não houver gravação em algum dia, não haverá cópia automática nesse dia. Para restaurar, pare o aplicativo, guarde a pasta `.data/` atual, copie o arquivo de backup escolhido para `.data/fisioapp.sqlite`, remova os arquivos `.sqlite-wal` e `.sqlite-shm` da pasta restaurada e reinicie o aplicativo. A pasta `.data/` está ignorada pelo Git.

### Migrar para Supabase

1. Crie um projeto Supabase e obtenha a string de conexão PostgreSQL em **Connect**. Escolha o modo de conexão adequado à hospedagem; mantenha a string apenas nas variáveis de ambiente do servidor. Em **Database Settings > SSL Configuration**, baixe o certificado da autoridade do Supabase e salve-o fora do Git (por exemplo, `.data/supabase-ca.crt`). Configure `SUPABASE_DB_CA_FILE` para esse caminho. Veja `.env.example`.
2. Pare o aplicativo para impedir gravações durante a migração. Sem `SUPABASE_DATABASE_URL` configurada, execute `npm run backup` e guarde a cópia fora do servidor.
3. Configure `SUPABASE_DATABASE_URL` e `SUPABASE_DB_CA_FILE` em `.env.local` e execute `node --env-file=.env.local scripts/migrate-supabase.mjs` (Node.js 22 ou superior). O comando cria o esquema privado `fisioapp`, importa o SQLite/JSON e confere o número de documentos. Se já houver dados diferentes no destino, ele interrompe sem sobrescrevê-los.
4. Configure a mesma variável no servidor do aplicativo e reinicie. Confira o login, a lista de pacientes e os prontuários. Se a variável estiver ausente, o aplicativo continua usando o SQLite local; se estiver presente e o PostgreSQL não estiver preparado, o acesso falha em vez de abrir um espaço vazio.

Essa primeira etapa mantém os logins existentes e armazena os documentos por espaço no PostgreSQL. A normalização de pacientes, atendimentos e prontuários em tabelas próprias e a possível adoção do Supabase Auth ficam para uma etapa posterior. Os backups SQLite não protegem o PostgreSQL: configure e verifique a recuperação do projeto Supabase separadamente.

É necessário Node.js 22 ou superior. As gravações usam controle de versão para evitar que uma instância sobrescreva alterações de outra. O login pausa por 15 minutos após 10 tentativas inválidas por e-mail. Antes de oferecer o serviço comercialmente, configure o armazenamento externo dos backups, recuperação de acesso e uma revisão de segurança e privacidade.

Para testar os perfis, crie usuários temporários em **Configurações > Usuários** e troque as senhas no primeiro acesso. Não publique credenciais de teste no README.

### Entrada com Google

No Google Cloud, configure a tela de consentimento OAuth e crie um cliente OAuth do tipo **Aplicativo da Web**. Cadastre exatamente `https://fisioapp-me-f364.vercel.app/api/auth/google/callback` em **URIs de redirecionamento autorizados**. Se a tela de consentimento estiver em modo de teste, inclua os e-mails da equipe como usuários de teste. Para desenvolvimento local, cadastre também `http://localhost:3000/api/auth/google/callback`.

Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI` como variáveis privadas no servidor (na Vercel, em **Production**). O URI configurado deve ser idêntico ao cadastrado no Google Cloud. Faça uma nova implantação depois de adicionar as variáveis. O botão **Continuar com Google** aparece somente quando todas estiverem configuradas.

O Google permite entrar em uma conta já cadastrada em **Configurações > Usuários**, desde que o e-mail verificado seja o mesmo. O primeiro acesso vincula essa identidade Google à conta. Contas desativadas, pacientes e usuários com senha temporária não entram por esse botão; estes devem primeiro entrar com a senha temporária e trocá-la. O Google não cria usuários nem altera seus perfis e permissões.

### Publicar na Vercel

O aplicativo Next.js está na pasta `app/`. Ao importar este repositório na Vercel, configure **Root Directory** como `app` e mantenha o comando de build `npm run build`. Os dados clínicos e os logins precisam estar no Supabase antes da publicação; o armazenamento local `.data/` não acompanha a implantação.

Configure as variáveis privadas para **Production** (e para **Preview** somente se quiser que as prévias acessem esse mesmo banco):

- `SUPABASE_DATABASE_URL`: URL PostgreSQL do projeto Supabase, sem parâmetros SSL. Para funções serverless, prefira a conexão **Transaction pooler** do painel Supabase.
- `SUPABASE_DB_CA_BASE64`: certificado CA do Supabase codificado em base64, sem quebras de linha. Gere a partir do arquivo baixado no painel com `base64 -w0 supabase-ca.crt` (Linux). Na Vercel, não configure `SUPABASE_DB_CA_FILE`, que aponta para um arquivo local.

As duas variáveis pertencem ao servidor; não use o prefixo `NEXT_PUBLIC_`. Depois de configurá-las, faça uma nova implantação e teste login, pacientes e agenda. O sistema usa uma conexão PostgreSQL por instância serverless e valida o certificado TLS.

Pela CLI, dentro de `app/`, use `npx vercel login`, `npx vercel link` e configure as variáveis com `npx vercel env add NOME production`. Como a raiz do projeto na Vercel é `app`, execute a publicação **na raiz do repositório** com `npx vercel deploy . --project fisioapp --prod --yes`. Nunca inclua a URL do banco ou o certificado em arquivos versionados.
