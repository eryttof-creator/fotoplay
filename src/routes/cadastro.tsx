import { createFileRoute } from '@tanstack/react-router';
import { AuthForm } from '@/components/AuthForm';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/cadastro')({head:()=>pageHead('Criar conta','Cadastre-se no Foto Play com e-mail e um @usuário exclusivo.'),component:Signup});
function Signup(){return <AuthForm signup/>;}
