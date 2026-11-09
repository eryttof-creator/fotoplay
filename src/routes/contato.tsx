import { createFileRoute } from '@tanstack/react-router';
import { InfoPage } from '@/components/InfoPage';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/contato')({head:()=>pageHead('Contato','Fale com o projeto Foto Play e solicite atendimento sobre seus dados.'),component:Contact});
function Contact(){return <InfoPage title="Contato"><h2>Fale com o Foto Play</h2><p>Para dúvidas, sugestões, denúncias ou solicitações de exclusão de conta e dados:</p><a className="block break-all text-lg font-bold text-primary underline" href="mailto:Erickpontess083@gmail.com">Erickpontess083@gmail.com</a><p>Informe seu apelido ou @usuário e descreva o pedido. Não envie senhas, documentos ou outras informações sensíveis por e-mail.</p></InfoPage>;}