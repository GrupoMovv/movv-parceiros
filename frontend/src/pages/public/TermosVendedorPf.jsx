import { Link } from 'react-router-dom';
import BotaoVoltar from '../../components/ui/BotaoVoltar';

// Termos do Vendedor Pessoa Física — texto da minuta revisada em 30/09/2026
// (doc "Termos do Vendedor Pessoa Física — revisão jurídica"). A versão aqui
// TEM que bater com TERMOS_PF_VERSAO (backend/src/config/vendedorPf.js):
// mudou o texto, suba as duas juntas. Campos [ENTRE COLCHETES] = pendentes
// do Junior antes do lançamento.
export const TERMOS_PF_VERSAO = '2026-09-30';

const SECOES = [
  ['1. O que o IUB Mais+ faz', [
    'O IUB Mais+ é uma vitrine digital que aproxima consumidores e vendedores de Itumbiara e região. O vendedor publica anúncios; o consumidor entra em contato com o vendedor, pelo WhatsApp ou outro canal indicado, para combinar compra, pagamento e entrega.',
    'O IUB Mais+ não vende, não compra, não recebe pagamentos, não entrega e não guarda os produtos anunciados. Se no futuro oferecer pagamento ou entrega, esses serviços terão termos próprios, apresentados antes da contratação.',
  ]],
  ['2. Definições', [
    'Vendedor Pessoa Física: pessoa natural cadastrada com CPF. Pode ser Vendedor Casual (venda ocasional) ou Empreendedor (venda frequente), conforme o que declarar e o uso da conta.',
    'Consumidor: quem adquire ou usa o produto ou serviço anunciado. Anúncio: a oferta publicada pelo vendedor, com fotos, descrição, preço e condições.',
  ]],
  ['3. Conta com CPF não é autorização de atividade', [
    'Criar conta com CPF dá direito apenas de usar a plataforma nos limites destes Termos.',
    'O IUB Mais+ não autoriza, licencia ou atesta a regularidade de nenhuma atividade. Aceitar o cadastro com CPF não significa que o vendedor está dispensado de CNPJ, inscrição, licença, alvará, registro profissional, nota fiscal ou tributo.',
  ]],
  ['4. Quem pode se cadastrar', [
    'Pode se cadastrar a pessoa que: (a) tenha 18 anos ou mais; (b) seja titular do CPF informado; (c) forneça dados verdadeiros, completos e atualizados; (d) aceite estes Termos.',
    'É permitida uma conta de vendedor por CPF. É proibido usar CPF, documento ou foto de outra pessoa, criar conta em nome de terceiro, usar documento falso e criar contas para contornar bloqueios.',
  ]],
  ['5. Verificação de identidade', [
    'Para prevenir fraudes, o IUB Mais+ pede foto de documento oficial com foto e foto do rosto segurando o documento.',
    'Essas imagens são usadas só para conferir que o CPF pertence a quem se cadastra, são vistas apenas pela equipe de verificação e ficam guardadas de forma privada, pelo prazo [A DEFINIR].',
    'Enquanto a verificação não termina, os anúncios não são publicados. Se a identidade não puder ser confirmada, a conta pode ser recusada.',
  ]],
  ['6. Responsabilidade do vendedor pela atividade', [
    'O vendedor é o único responsável pela legalidade da atividade que exerce e pelos produtos e serviços que oferece, inclusive origem, qualidade, segurança, higiene, conservação e entrega.',
    'Cabe ao vendedor obter e manter as licenças, autorizações e registros que sua atividade exigir, e cumprir a legislação aplicável, inclusive tributária, sanitária, de defesa do consumidor, ambiental, de propriedade intelectual e municipal.',
  ]],
  ['7. Obrigações fiscais e documentais', [
    'O vendedor é responsável por verificar e cumprir suas obrigações fiscais e tributárias, inclusive quando a frequência ou o volume de vendas tornar necessária a formalização como MEI ou empresa.',
    'O vendedor deve entregar ao consumidor os documentos que a lei exigir para a operação. O vendedor pessoa física sem inscrição que o permita não emite nota fiscal, e o anúncio informará isso ao consumidor. O IUB Mais+ não presta consultoria contábil ou tributária.',
  ]],
  ['8. Produtos e serviços proibidos ou com regras especiais', [
    'É proibido anunciar o que a lei proíbe, o que for falsificado, pirateado ou de origem ilícita, o que viole direitos de terceiros e o que ofereça risco à saúde ou à segurança.',
    'Algumas categorias são bloqueadas para vendedores com CPF, mesmo quando a venda seria possível com licença — entre elas bebida alcoólica, cigarro e remédio —, e o próprio sistema aplica esse bloqueio. Categorias com regras especiais podem exigir declarações, documentos ou informações adicionais antes da publicação.',
  ]],
  ['9. Quando o IUB Mais+ pode exigir MEI ou CNPJ', [
    'O IUB Mais+ pode sugerir ou exigir a migração da conta para MEI ou CNPJ quando: (a) a categoria exigir cadastro empresarial; (b) a frequência ou o volume de vendas indicar atividade habitual; (c) uma funcionalidade depender de cadastro empresarial; (d) houver exigência legal ou de autoridade. A migração pode exigir nova verificação.',
  ]],
  ['10. Anúncios', [
    'O anúncio deve informar de forma correta, clara e em português o produto ou serviço, preço, quantidade, características, condições, prazo de entrega e riscos, quando houver. O vendedor deve entregar exatamente o que anunciou.',
    'Todo anúncio de vendedor com CPF passa por moderação antes de ser publicado. O IUB Mais+ pode recusar, editar a categoria ou remover anúncios que violem a lei ou estes Termos.',
  ]],
  ['11. Relação com o consumidor', [
    'O vendedor responde perante o consumidor pela venda que realizar, nos termos da legislação de defesa do consumidor, quando aplicável, inclusive quanto a vícios do produto ou serviço e ao direito de arrependimento em compras feitas fora do estabelecimento. As ferramentas de contato ou denúncia do IUB Mais+ não substituem as obrigações do vendedor.',
  ]],
  ['12. Moderação, denúncia e medidas', [
    'Diante de indício de fraude, informação falsa, produto proibido, uso de CPF de terceiro ou violação destes Termos, o IUB Mais+ pode: pedir documentos; suspender anúncios; limitar funcionalidades; suspender ou encerrar a conta; comunicar autoridades quando a lei exigir ou permitir. Sempre que possível, informará o motivo e dará oportunidade de correção.',
  ]],
  ['13. Dados pessoais e CPF', [
    'O IUB Mais+ trata os dados do vendedor como controlador, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), para: criar e manter a conta; verificar identidade e prevenir fraude; publicar anúncios; permitir o contato do consumidor; cumprir obrigações legais e ordens de autoridades; e defender direitos em processos.',
    'O CPF, a data de nascimento, o endereço completo e as imagens de verificação não aparecem nos anúncios. O nome completo, a cidade e o bairro do vendedor aparecem para o consumidor. O IUB Mais+ poderá informar CPF e endereço do vendedor ao consumidor com interesse legítimo na identificação do fornecedor, ou a autoridade competente, na forma da lei.',
    'O vendedor pode exercer os direitos de titular (confirmação, acesso, correção, eliminação e demais previstos em lei) pelo canal [CANAL DE PRIVACIDADE].',
  ]],
  ['14. Compartilhamento de dados', [
    'Os dados podem ser compartilhados, apenas no necessário, com prestadores de tecnologia que operam a plataforma (hospedagem, armazenamento de imagens, mensagens), com autoridades públicas quando a lei exigir, e com o consumidor na forma do item 13. O IUB Mais+ não vende dados pessoais.',
  ]],
  ['15. Registros de acesso', [
    'O IUB Mais+ guarda os registros de acesso à plataforma (data, hora e IP) pelo prazo previsto no Marco Civil da Internet e os fornece mediante ordem judicial.',
  ]],
  ['16. Declarações do vendedor', [
    'Ao aceitar estes Termos, o vendedor declara que: (a) tem 18 anos ou mais; (b) é o titular do CPF informado; (c) as informações fornecidas são verdadeiras; (d) conhece e cumpre as regras legais da sua atividade; (e) não anunciará produtos ou serviços proibidos.',
  ]],
  ['17. Papel e responsabilidade do IUB Mais+', [
    'O IUB Mais+ não é fabricante, fornecedor, proprietário ou vendedor dos produtos e serviços anunciados, salvo quando indicado expressamente. Usa verificação, moderação e denúncia para reduzir irregularidades, mas não garante que todo anúncio ou vendedor esteja regular.',
    'A responsabilidade de cada parte perante o consumidor segue a legislação aplicável. Se o IUB Mais+ for condenado ou pagar por dano causado por ato ou omissão do vendedor, o vendedor deverá ressarci-lo.',
  ]],
  ['18. Planos e cobrança', [
    'O vendedor pessoa física contrata um plano mensal (Vendedor Casual ou Empreendedor), com preço e condições mostrados antes da contratação. O IUB Mais+ não cobra comissão sobre as vendas.',
  ]],
  ['19. Conta e segurança', [
    'A conta é pessoal e intransferível. O vendedor deve proteger seu acesso e avisar o IUB Mais+ de qualquer uso não autorizado. O vendedor pode encerrar a conta a qualquer momento pelo painel ou pelo canal de atendimento.',
  ]],
  ['20. Alterações destes Termos', [
    'O IUB Mais+ pode alterar estes Termos. Alterações relevantes serão avisadas com [X] dias de antecedência pelos canais cadastrados. Quem não concordar pode encerrar a conta. Cada versão fica disponível na plataforma, com a data de início de vigência.',
  ]],
  ['21. Aceite eletrônico', [
    'O aceite é feito ao marcar a caixa de aceite na tela de cadastro. O sistema registra a versão destes Termos, data, hora, IP e navegador.',
  ]],
  ['22. Lei aplicável e foro', [
    'Aplicam-se as leis brasileiras. Fica eleito o foro do domicílio do vendedor, salvo disposição legal em contrário.',
  ]],
  ['23. Contato', [
    'IUB Mais+ — [RAZÃO SOCIAL], CNPJ [CNPJ], [ENDEREÇO]. Atendimento: [CANAL]. Privacidade: [E-MAIL OU CANAL DO ENCARREGADO].',
  ]],
];

export default function TermosVendedorPf() {
  return (
    <div className="min-h-screen w-full bg-white">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <BotaoVoltar fallback="/vender" />
        <h1 className="text-2xl font-extrabold text-slate-900 mt-3">Termos do Vendedor Pessoa Física (CPF)</h1>
        <p className="text-sm text-slate-500 mt-1">IUB Mais+ · versão {TERMOS_PF_VERSAO}</p>
        <p className="text-sm text-slate-700 mt-4">Estes Termos regulam o uso do IUB Mais+ por pessoas físicas que anunciam produtos ou serviços usando o próprio CPF.</p>
        {SECOES.map(([titulo, paragrafos]) => (
          <section key={titulo} className="mt-6">
            <h2 className="font-bold text-slate-900">{titulo}</h2>
            {paragrafos.map(p => <p key={p.slice(0, 40)} className="text-sm text-slate-700 mt-2 leading-relaxed">{p}</p>)}
          </section>
        ))}
        <p className="text-sm text-slate-500 mt-8"><Link to="/vender/pessoa-fisica" className="underline">Voltar ao cadastro</Link></p>
      </div>
    </div>
  );
}
