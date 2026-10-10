package com.twelveaxes.model;

/**
 * Livro recomendado no resultado, já no idioma pedido e com o link de afiliado montado.
 *
 * @param compatibility compatibilidade do usuário com a personalidade associada
 */
public record BookRecommendation(
        String personalityId,
        String personalityName,
        String imagePath,
        String title,
        Integer year,
        String url,
        String author,
        String associationType,
        double compatibility
) {
}
