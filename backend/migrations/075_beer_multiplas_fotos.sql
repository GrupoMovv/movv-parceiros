-- Disk Bebidas com várias fotos por produto (Junior, 30/09/2026) — igual ao
-- formulário comum: lista [{url, publicId}] na ordem; a primeira é a
-- principal. `imagem`/`imagem_public_id` continuam existindo e SEMPRE
-- espelham a principal (card, busca, moderação e painel seguem lendo
-- `imagem` sem mudança).
ALTER TABLE beer_produtos ADD COLUMN IF NOT EXISTS fotos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- produtos que já tinham foto: ela vira a lista de 1
UPDATE beer_produtos
   SET fotos = jsonb_build_array(jsonb_build_object('url', imagem, 'publicId', imagem_public_id))
 WHERE imagem IS NOT NULL AND fotos = '[]'::jsonb;
