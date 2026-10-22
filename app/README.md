# FisioApp (protótipo de espaços individuais)

Execute `npm ci` e `npm run dev -- --hostname 0.0.0.0 --port 3000` nesta pasta. A página inicial abre no login. Somente no primeiro acesso do administrador, use o link para `/setup`. O servidor cria um código de instalação em `.data/setup-token` (ou em `$FISIOAPP_DATA_DIR/setup-token`). Leia esse arquivo no servidor e use o código para criar a sua conta de administrador. O arquivo é removido após a criação da conta e o link de configuração desaparece do login. Nunca envie o código nem senhas para o repositório.

O super administrador entra no FisioApp normal, com pacientes e agenda em seu próprio espaço. Em `/configuracoes`, cria o login de cada fisioterapeuta com e-mail e senha temporária. Cada profissional troca a senha ao entrar, configura seu perfil, locais, tipos de atendimento, convênios e horários e acessa apenas seus próprios pacientes e agenda. Suspender um espaço encerra suas sessões de acesso. O super administrador gerencia contas, mas não vê os dados clínicos dos outros espaços.

Os dados antigos em `.data/fisioapp.json` continuam no mesmo arquivo. Quando houver dados antigos, o painel oferece atribuí-los explicitamente a um espaço. Outros espaços usam arquivos próprios em `.data/spaces/`. Contas, sessões de acesso e configurações gerais ficam em `.data/platform.json`. A pasta `.data/` está ignorada pelo Git. Faça cópias de segurança dela.

Esta persistência em arquivos é adequada para desenvolvimento e validação do produto. Antes de oferecer o serviço comercialmente, migre para banco de dados com isolamento por cliente, backups automáticos, recuperação de acesso, proteção contra tentativas de login e operação segura de múltiplas instâncias.
