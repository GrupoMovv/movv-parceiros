-- 6º nível do Jogo da Memória (LENDARIO, 21 pares / 7x6). Execute: node migrations/run.js
--
-- A migration 048 fixou `CHECK (nivel BETWEEN 1 AND 5)` em duas colunas, e
-- com ela no lugar TODA partida do nível 6 estoura no INSERT — o nível novo
-- não é só configuração. Aqui a faixa vai pra 1..6.
--
-- O limite superior continua existindo de propósito: ele é a rede que pega
-- nível inventado vindo do cliente (memoriaController já valida, mas o banco
-- é a última linha). Próximo nível = subir o 6 aqui junto do config.
--
-- Os CHECK antigos nasceram sem nome explícito, então acha pelo conteúdo e
-- recria — mesmo padrão da migration 052 (run.js reroda tudo sempre, então
-- isso precisa ser idempotente).
DO $$
DECLARE
  alvo   TEXT;
  achado TEXT;
BEGIN
  FOREACH alvo IN ARRAY ARRAY['sindicato_memoria_partidas', 'sindicato_memoria_niveis'] LOOP
    -- Só mexe se a tabela existir (banco novo roda as migrations em ordem).
    IF to_regclass(alvo) IS NULL THEN
      CONTINUE;
    END IF;

    SELECT conname INTO achado FROM pg_constraint
     WHERE conrelid = alvo::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%nivel%'
       AND pg_get_constraintdef(oid) ILIKE '%5%';

    IF achado IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', alvo, achado);
    END IF;

    -- Nome explícito agora, pra próxima troca não precisar caçar de novo.
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK (nivel BETWEEN 1 AND 6)',
      alvo, alvo || '_nivel_faixa_check'
    );
  END LOOP;
EXCEPTION
  -- ADD CONSTRAINT com o mesmo nome numa re-execução: já está aplicado.
  WHEN duplicate_object THEN NULL;
END $$;
