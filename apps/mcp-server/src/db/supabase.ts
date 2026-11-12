/**
 * Autor(es): Marcus Martinho <marcus.antonio.martinho.silva@gmail.com>
 * Data Criação: 2026-11-12
 * Data Atualização: 2026-11-12
 * Descrição: Módulo que cria e exporta o cliente Supabase compartilhado pelas tools do
 * servidor MCP, usando a URL do projeto e a service key lidas das variáveis de ambiente.
 *
 * As variáveis SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórias; sem elas o módulo
 * lança erro já no carregamento, impedindo o servidor de iniciar.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
}

/** Cliente Supabase autenticado com a service key (uso exclusivo no servidor). */
export const supabase = createClient(supabaseUrl, supabaseKey);
