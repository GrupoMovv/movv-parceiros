-- Assinatura por cartão recorrente (fase C do Mercado Pago): preapproval
-- com free_trial de 7 dias. O cartão fica no MP (tokenizado no navegador
-- pelos Bricks — número/CVV nunca passam pelo nosso servidor). Aqui só o
-- que dá pra mostrar em "Minha Assinatura" ("Mastercard final 6351").
-- Execute: node migrations/run.js

ALTER TABLE sindicato_assinaturas
  ADD COLUMN IF NOT EXISTS cartao_bandeira VARCHAR(30),
  ADD COLUMN IF NOT EXISTS cartao_final    VARCHAR(4);
