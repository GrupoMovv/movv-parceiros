import { Link } from 'react-router-dom';
import BotaoVoltar from '../../components/ui/BotaoVoltar';

// Política de Privacidade do IUB Mais+ (LGPD básica), escrita em 01/10/2026
// a partir do que o sistema realmente coleta. Mudou coleta, prestador ou
// prazo de guarda? Atualize o texto E a versão. Razão social conferida na
// Receita em 30/09/2026 — quando virar Grupo Movv, trocar aqui e nos Termos PF.
export const POLITICA_PRIVACIDADE_VERSAO = '2026-10-01';

const SECOES = [
  ['1. Quem cuida dos seus dados', [
    'O IUB Mais+ é operado pelo Grupo Movv (Open Gestao Empresarial Ltda), CNPJ 61.644.671/0001-80, Av. Washington Luiz, 125, Sala 1, Afonso Pena, Itumbiara/GO. Ele é o controlador dos dados pessoais tratados na plataforma, nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).',
    'Encarregado de dados pessoais (DPO): junior@grupomovv.com.',
  ]],
  ['2. A quem esta Política se aplica', [
    'A todos que usam o IUB Mais+: clientes (consumidores e associados do SECI), vendedores com CPF, lojistas e prestadores com CNPJ, tutores de pets atendidos por parceiros, indicadores e candidatos a entregador.',
  ]],
  ['3. Que dados coletamos', [
    'Conta de cliente: nome completo, CPF, data de nascimento, WhatsApp, e-mail, endereço (CEP, rua, número, bairro, cidade), CNPJ da empresa onde trabalha (opcional) e senha (guardada só em forma criptografada, nunca em texto).',
    'Vendedor com CPF: os dados acima, mais nível escolhido (Vendedor Casual ou Empreendedor), foto de documento oficial com foto e selfie segurando o documento (ver item 6), anúncios, fotos de produtos e o registro do aceite dos Termos.',
    'Lojista ou prestador com CNPJ: dados da empresa e do responsável, contatos, endereço, anúncios, promoções, fotos e dados do plano contratado.',
    'Pets: nome, espécie, raça, porte, sexo, nascimento, foto, vacinas, alergias, medicamentos, comportamento, veterinário e contato extra, informados pelo tutor; pedidos de horário, fotos de atendimento e avaliações.',
    'IUB Beer (+18): confirmação de maioridade, com data, IP e navegador.',
    'Indicadores: nome, CPF, e-mail, WhatsApp e chave PIX para pagamento de comissões. Candidatos a entregador: nome, WhatsApp, se tem moto e bairros de atuação.',
    'Coletados automaticamente: endereço IP, data e hora de acesso, navegador e cliques em lojas e anúncios (usados para contar visitas e mostrar estatísticas ao lojista).',
  ]],
  ['4. Para que usamos e com qual base legal', [
    'Criar e manter sua conta, permitir login e recuperar senha — execução do contrato (art. 7º, V).',
    'Conferir se você ou sua empresa é associada ao SECI, emitir a carteirinha digital e liberar preços de associado — execução do contrato.',
    'Verificar a identidade de vendedores com CPF e prevenir fraude — prevenção à fraude e segurança do titular (art. 11, II, "g") e legítimo interesse (art. 7º, IX).',
    'Publicar anúncios e permitir que o consumidor fale com o vendedor — execução do contrato.',
    'Cobrar planos e pagar comissões — execução do contrato e cumprimento de obrigação legal (art. 7º, II).',
    'Confirmar maioridade para acesso ao IUB Beer — cumprimento de obrigação legal (venda de bebida alcoólica só a maiores de 18).',
    'Mandar ofertas e novidades pelo WhatsApp — consentimento (art. 7º, I), que você pode retirar a qualquer momento. Avisos sobre sua conta, pedidos e pagamentos são enviados sempre, porque fazem parte do serviço.',
    'Guardar registros de acesso, responder a autoridades e defender direitos em processos — obrigação legal e exercício regular de direitos (art. 7º, VI).',
    'Medir uso da plataforma e melhorar o serviço — legítimo interesse, sempre com o mínimo de dados.',
  ]],
  ['5. O que aparece para outras pessoas', [
    'Nos anúncios aparecem nome do vendedor ou da loja, cidade, bairro, WhatsApp de contato, produtos e fotos. CPF, data de nascimento, endereço completo e imagens de verificação NÃO aparecem.',
    'A ficha do pet só é vista pelo pet shop que você autorizar, e você pode revogar a autorização quando quiser.',
  ]],
  ['6. Documento e selfie do vendedor com CPF', [
    'As fotos do documento e da selfie são usadas só para conferir que o CPF pertence a quem se cadastra. Ficam guardadas de forma privada (sem endereço público), são vistas apenas pela equipe de verificação e são apagadas assim que a verificação termina, aprovada ou recusada.',
    'Depois disso fica guardado só o registro da conferência: resultado, data e quem conferiu. A verificação é feita por uma pessoa, não por inteligência artificial.',
  ]],
  ['7. Com quem compartilhamos', [
    'SECI — Sindicato do Comércio: para conferir filiação, emitir carteirinha e aplicar benefícios de associado.',
    'Lojistas e prestadores: os dados necessários para atender você quando você faz um pedido, pede horário, autoriza a ficha do pet ou demonstra interesse.',
    'Prestadores de tecnologia que operam a plataforma, apenas no necessário: hospedagem e banco de dados; Cloudinary (armazenamento de imagens); Mercado Pago (pagamentos); Z-API (envio de mensagens de WhatsApp); Resend (envio de e-mails); OpenAI (leitura de fotos de produtos para sugerir o cadastro — nunca recebe documento ou selfie); ViaCEP e BrasilAPI (consulta de CEP e CNPJ).',
    'Autoridades públicas, quando a lei ou ordem judicial exigir.',
    'O IUB Mais+ NÃO vende dados pessoais.',
  ]],
  ['8. Pagamentos', [
    'Os dados do cartão são digitados direto no ambiente do Mercado Pago e o IUB Mais+ não guarda o número do cartão. Guardamos só o necessário para controlar a assinatura: plano, valor, data, situação do pagamento e identificador da transação.',
  ]],
  ['9. Transferência internacional', [
    'Alguns prestadores (como Cloudinary, OpenAI e Resend) guardam ou processam dados fora do Brasil. Nesses casos a transferência é feita para cumprir o contrato com você e com prestadores que adotam medidas de segurança compatíveis com a LGPD (art. 33).',
  ]],
  ['10. Cookies e armazenamento no navegador', [
    'O IUB Mais+ não usa cookies de publicidade nem ferramentas de rastreamento de terceiros. Usamos o armazenamento do seu navegador só para manter você conectado, guardar o carrinho e lembrar preferências simples (som e recordes dos jogos, avisos já vistos, instalação do app). Esses dados ficam no seu aparelho. Ao sair da conta, o acesso é apagado do navegador.',
  ]],
  ['11. Por quanto tempo guardamos', [
    'Dados da conta: enquanto ela estiver ativa. Documento e selfie: até o fim da verificação. Registros de acesso: 6 meses (Marco Civil da Internet). Dados de pagamentos e cobranças: 5 anos (obrigações fiscais).',
    'Quando a conta é encerrada, os dados são apagados ou anonimizados, salvo o que a lei obriga a guardar ou o necessário para defender direitos — e só pelo prazo dessa obrigação.',
  ]],
  ['12. Menores de idade', [
    'A conta de cliente pode ser criada a partir de 14 anos, só com os dados necessários e no melhor interesse do adolescente. Menores de 18 anos não podem vender na plataforma nem acessar o IUB Beer. Pais e responsáveis podem pedir acesso, correção ou exclusão pelo contato do item 15.',
  ]],
  ['13. Segurança', [
    'Usamos conexão criptografada (HTTPS), senhas criptografadas, acesso restrito por perfil e armazenamento privado para imagens sensíveis. Nenhum sistema é 100% seguro: se acontecer um incidente que possa causar risco relevante, avisaremos os titulares afetados e a ANPD, como manda a lei.',
  ]],
  ['14. Seus direitos', [
    'Você pode pedir, a qualquer momento: confirmação de que tratamos seus dados; acesso; correção de dados incompletos ou errados; anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei; portabilidade; eliminação dos dados tratados com consentimento; informação sobre com quem compartilhamos; revogação do consentimento; e revisão de decisões automatizadas (art. 18 da LGPD).',
    'Para pedir, escreva para junior@grupomovv.com do e-mail cadastrado ou fale pelo WhatsApp (64) 99235-9408. Podemos pedir confirmação de identidade antes de atender. Respondemos em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).',
  ]],
  ['15. Contato', [
    'Encarregado de dados pessoais: junior@grupomovv.com. Atendimento: WhatsApp (64) 99235-9408. Grupo Movv (Open Gestao Empresarial Ltda), CNPJ 61.644.671/0001-80, Av. Washington Luiz, 125, Sala 1, Afonso Pena, Itumbiara/GO.',
  ]],
  ['16. Alterações desta Política', [
    'Esta Política pode mudar. Mudanças relevantes serão avisadas com antecedência pelos canais cadastrados, e a versão em vigor fica sempre nesta página, com a data de início.',
  ]],
];

export default function PoliticaPrivacidade() {
  return (
    <div className="min-h-screen w-full bg-white">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <BotaoVoltar fallback="/marketplace" />
        <h1 className="text-2xl font-extrabold text-slate-900 mt-3">Política de Privacidade</h1>
        <p className="text-sm text-slate-500 mt-1">IUB Mais+ · versão {POLITICA_PRIVACIDADE_VERSAO}</p>
        <p className="text-sm text-slate-700 mt-4">Esta Política explica, em linguagem simples, quais dados pessoais o IUB Mais+ coleta, para que usa, com quem compartilha, por quanto tempo guarda e como você exerce seus direitos.</p>
        {SECOES.map(([titulo, paragrafos]) => (
          <section key={titulo} className="mt-6">
            <h2 className="font-bold text-slate-900">{titulo}</h2>
            {paragrafos.map(p => <p key={p.slice(0, 40)} className="text-sm text-slate-700 mt-2 leading-relaxed">{p}</p>)}
          </section>
        ))}
        <p className="text-sm text-slate-500 mt-8"><Link to="/termos/vendedor-pessoa-fisica" className="underline">Termos do Vendedor Pessoa Física</Link></p>
      </div>
    </div>
  );
}
