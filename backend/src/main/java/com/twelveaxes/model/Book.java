package com.twelveaxes.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.Map;

/**
 * Livro de referência associado a uma personalidade (um por personalidade).
 *
 * @param title título por idioma ("pt", "en")
 * @param url link direto de afiliado por idioma; vazio cai numa busca na Amazon
 * @param author autor real da obra; nulo em entradas legadas cai no nome da personalidade
 * @param associationType "author" quando a personalidade escreveu/contribuiu para a obra,
 *                        "biography" quando a obra é sobre a personalidade
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record Book(
        String personalityId,
        Map<String, String> title,
        Integer year,
        Map<String, String> url,
        String author,
        String associationType
) {
}
