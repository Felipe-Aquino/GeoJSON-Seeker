enum Languages {
  LANG_PT_BR,
  LANG_EN,
};

enum Translations {
  TR_NOT_SUPPORTED = 0,
  TR_INSTRUCTION,
  TR_LOAD_CANVAS,
  TR_ADD_POINTS,
  TR_REMOVE_POINTS,
  TR_CONNECT_POINTS,
  TR_COPY,
  COUNT_TRANSLATIONS,
};

static const char *__pt_br[COUNT_TRANSLATIONS] = {
    "Ops! Este site não é compatível.",
    "Clique em Load Canvas",
    "Load Canvas",
    "Marcar pontos",
    "Remover pontos",
    "Conectar pontos",
    "Copiar"
};

static const char *__en[COUNT_TRANSLATIONS] = {
    "Oops! This site isn't supported.",
    "Click on Load Canvas",
    "Load Canvas",
    "Add points",
    "Remove points",
    "Connect points",
    "Copy"
};

static const char **translations = __en;

void set_language_translation(enum Languages lang) {
    if (lang == LANG_PT_BR) {
        translations = __pt_br;
    } else {
        translations = __en;
    }
}

#define _TR(t) translations[TR_ ##t]
