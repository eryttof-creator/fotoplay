import { createFileRoute } from '@tanstack/react-router';
import { AuthForm } from '@/components/AuthForm';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/auth')({head:()=>pageHead('Entrar','Entre na sua conta Foto Play ou recupere sua senha.'),component:Login});
function Login(){return <AuthForm/>;}
