export const cap = (s) => {
  if (!s) return "";
  const clean = String(s).replace(/_/g, " ");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
};