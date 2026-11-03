// Le dernier mot d'un titre passe sur le marqueur ; une ponctuation finale reste collée à lui (« Yoann ! »).
export const splitTitle = (title: string): { lead: string; mark: string } => {
  const text = title.trim();
  const found = /\S+(?:\s+[!?:;…»]+)?$/u.exec(text);
  if (!found) return { lead: "", mark: text };
  return { lead: text.slice(0, found.index), mark: found[0] };
};
