use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

/// Vault-relative location of the sidebar tree definition (ADR 0188).
const VAULT_TREE_RELATIVE_PATH: &str = "tolaria/config/tree.yml";
const VAULT_TREE_VERSION: u32 = 1;

/// Presentation overrides for one entry. An absent field means "not set here",
/// so the resolver falls through to frontmatter and then to the default.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct VaultTreeNodeRecord {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub order: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

impl VaultTreeNodeRecord {
    fn is_empty(&self) -> bool {
        self.parent.is_none() && self.order.is_none() && self.icon.is_none()
    }

    fn normalized(mut self) -> Self {
        if let Some(parent) = self.parent.as_deref() {
            self.parent = Some(parent.trim().trim_matches('/').to_string());
        }
        if let Some(icon) = self.icon.as_deref() {
            self.icon = Some(icon.trim().to_string());
        }
        self
    }
}

/// The whole `tolaria/config/tree.yml` document. Keys are vault-relative paths;
/// `BTreeMap` keeps serialization order stable so diffs stay readable.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VaultTree {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default, deserialize_with = "deserialize_node_map")]
    pub nodes: BTreeMap<String, VaultTreeNodeRecord>,
}

fn deserialize_node_map<'de, D>(
    deserializer: D,
) -> Result<BTreeMap<String, VaultTreeNodeRecord>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let raw: BTreeMap<String, Option<VaultTreeNodeRecord>> = BTreeMap::deserialize(deserializer)?;
    Ok(raw.into_iter().filter_map(|(key, record)| record.map(|r| (key, r))).collect())
}

fn default_version() -> u32 {
    VAULT_TREE_VERSION
}

impl Default for VaultTree {
    fn default() -> Self {
        Self {
            version: VAULT_TREE_VERSION,
            nodes: BTreeMap::new(),
        }
    }
}

pub fn vault_tree_path(vault_path: &Path) -> PathBuf {
    vault_path.join(VAULT_TREE_RELATIVE_PATH)
}

/// Vault-relative key with forward slashes and no surrounding whitespace or separators.
pub fn normalize_vault_key(path: &str) -> String {
    path.trim().replace('\\', "/").trim_matches('/').to_string()
}

/// Parse a tree document. Malformed YAML yields the empty tree so a hand-edited
/// file degrades to "no override" instead of breaking the sidebar.
pub fn parse_vault_tree(raw: &str) -> VaultTree {
    match serde_yaml::from_str::<VaultTree>(raw) {
        Ok(tree) => normalize_vault_tree(tree),
        Err(error) => {
            log::warn!("Ignoring unreadable vault tree definition: {error}");
            VaultTree::default()
        }
    }
}

fn normalize_vault_tree(tree: VaultTree) -> VaultTree {
    let mut nodes = BTreeMap::new();
    for (key, record) in tree.nodes {
        let key = normalize_vault_key(&key);
        if key.is_empty() || record.is_empty() {
            continue;
        }
        nodes.insert(key, record.normalized());
    }
    VaultTree {
        version: tree.version,
        nodes,
    }
}

/// Read the tree definition, returning the empty tree when the file is missing.
pub fn read_vault_tree(vault_path: &Path) -> VaultTree {
    match fs::read_to_string(vault_tree_path(vault_path)) {
        Ok(raw) => parse_vault_tree(&raw),
        Err(_) => VaultTree::default(),
    }
}

/// Serialize and write the tree definition, creating `tolaria/config/` as needed.
pub fn write_vault_tree(vault_path: &Path, tree: &VaultTree) -> Result<(), String> {
    let path = vault_tree_path(vault_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create vault tree directory: {e}"))?;
    }
    let yaml = serde_yaml::to_string(tree)
        .map_err(|e| format!("Failed to serialize vault tree: {e}"))?;
    fs::write(&path, yaml).map_err(|e| format!("Failed to write vault tree: {e}"))
}

/// Drop records whose target no longer exists on disk (ADR 0002: the filesystem
/// decides which entries exist). Returns whether anything was removed so callers
/// can skip a redundant write.
pub fn prune_missing_nodes(vault_path: &Path, tree: &mut VaultTree) -> bool {
    let before = tree.nodes.len();
    tree.nodes.retain(|key, _| vault_path.join(key).exists());
    tree.nodes.len() != before
}

/// Follow an in-app rename or move: relocate the entry's record (and everything
/// recorded beneath it) to the new key and repoint parent references. A no-op
/// unless the entry actually had records, so plain renames never touch tree.yml.
pub fn rename_key(vault_path: &Path, old_key: &str, new_key: &str) -> Result<bool, String> {
    let from = normalize_vault_key(old_key);
    let to = normalize_vault_key(new_key);
    if from.is_empty() || to.is_empty() || from == to {
        return Ok(false);
    }

    let tree = read_vault_tree(vault_path);
    let mut nodes = BTreeMap::new();
    let mut changed = false;
    for (key, mut record) in tree.nodes {
        let moved_key = if key == from {
            changed = true;
            to.clone()
        } else if key.starts_with(&format!("{from}/")) {
            changed = true;
            format!("{to}{}", &key[from.len()..])
        } else {
            key
        };
        if let Some(parent) = record.parent.as_deref() {
            if parent == from {
                record.parent = Some(to.clone());
                changed = true;
            } else if parent.starts_with(&format!("{from}/")) {
                record.parent = Some(format!("{to}{}", &parent[from.len()..]));
                changed = true;
            }
        }
        nodes.insert(moved_key, record);
    }

    if !changed {
        return Ok(false);
    }
    write_vault_tree(vault_path, &VaultTree { version: tree.version, nodes })?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn record(parent: Option<&str>, order: Option<i64>, icon: Option<&str>) -> VaultTreeNodeRecord {
        VaultTreeNodeRecord {
            parent: parent.map(str::to_string),
            order,
            icon: icon.map(str::to_string),
        }
    }

    #[test]
    fn missing_tree_file_reads_as_empty() {
        let dir = tempfile::TempDir::new().unwrap();
        assert_eq!(read_vault_tree(dir.path()), VaultTree::default());
    }

    #[test]
    fn malformed_tree_file_reads_as_empty() {
        assert_eq!(parse_vault_tree("nodes: [not, a, map"), VaultTree::default());
        assert_eq!(parse_vault_tree(""), VaultTree::default());
    }

    #[test]
    fn roundtrip_preserves_every_field() {
        let dir = tempfile::TempDir::new().unwrap();
        let mut tree = VaultTree::default();
        tree.nodes.insert(
            "attachments/architecture.drawio".to_string(),
            record(Some("project.md"), Some(2), Some("blueprint")),
        );

        write_vault_tree(dir.path(), &tree).unwrap();

        assert!(vault_tree_path(dir.path()).exists());
        assert_eq!(read_vault_tree(dir.path()), tree);
    }

    #[test]
    fn parse_normalizes_keys_and_drops_records_with_no_override() {
        let raw = "\
version: 1
nodes:
  '/docs/readme.md': { parent: ' project.md ' }
  'empty.md': {}
  'stale.md': null
";
        let tree = parse_vault_tree(raw);

        assert_eq!(tree.nodes.len(), 1);
        assert_eq!(
            tree.nodes.get("docs/readme.md"),
            Some(&record(Some("project.md"), None, None))
        );
    }

    #[test]
    fn rename_key_moves_records_subtrees_and_parent_references() {
        let dir = tempfile::TempDir::new().unwrap();
        let mut tree = VaultTree::default();
        tree.nodes.insert("docs/a.md".to_string(), record(Some("index.md"), None, Some("star")));
        tree.nodes.insert("docs/sub/b.md".to_string(), record(Some("docs/a.md"), None, None));
        tree.nodes.insert(
            "elsewhere.md".to_string(),
            record(Some("docs/a.md"), None, None),
        );
        write_vault_tree(dir.path(), &tree).unwrap();

        assert!(rename_key(dir.path(), "docs", "reference").unwrap());

        let renamed = read_vault_tree(dir.path());
        assert_eq!(renamed.nodes.get("reference/a.md"), Some(&record(Some("index.md"), None, Some("star"))));
        assert_eq!(renamed.nodes.get("reference/sub/b.md"), Some(&record(Some("reference/a.md"), None, None)));
        assert_eq!(renamed.nodes.get("elsewhere.md"), Some(&record(Some("reference/a.md"), None, None)));
        assert!(!renamed.nodes.contains_key("docs/a.md"));
    }

    #[test]
    fn rename_key_is_a_no_op_for_unrecorded_paths() {
        let dir = tempfile::TempDir::new().unwrap();
        assert!(!rename_key(dir.path(), "old.md", "new.md").unwrap());
        assert!(!vault_tree_path(dir.path()).exists());
    }

    #[test]
    fn serialized_output_omits_unset_fields_and_sorts_keys() {
        let mut tree = VaultTree::default();
        tree.nodes.insert("b.md".to_string(), record(None, None, Some("star")));
        tree.nodes.insert("a.md".to_string(), record(Some("p.md"), None, None));

        let yaml = serde_yaml::to_string(&tree).unwrap();

        assert!(yaml.contains("version: 1"));
        assert!(!yaml.contains("order:"));
        assert!(yaml.find("a.md").unwrap() < yaml.find("b.md").unwrap());
    }

    #[test]
    fn prune_drops_records_whose_target_is_gone() {
        let dir = tempfile::TempDir::new().unwrap();
        fs::create_dir_all(dir.path().join("tolaria")).unwrap();
        fs::write(dir.path().join("keep.md"), "# Keep").unwrap();

        let mut tree = VaultTree::default();
        tree.nodes.insert("keep.md".to_string(), record(None, Some(1), None));
        tree.nodes.insert("gone.md".to_string(), record(None, Some(2), None));

        assert!(prune_missing_nodes(dir.path(), &mut tree));
        assert_eq!(tree.nodes.len(), 1);
        assert!(tree.nodes.contains_key("keep.md"));
    }

    #[test]
    fn prune_reports_no_change_when_every_target_exists() {
        let dir = tempfile::TempDir::new().unwrap();
        fs::write(dir.path().join("keep.md"), "# Keep").unwrap();

        let mut tree = VaultTree::default();
        tree.nodes.insert("keep.md".to_string(), record(None, Some(1), None));

        assert!(!prune_missing_nodes(dir.path(), &mut tree));
        assert_eq!(tree.nodes.len(), 1);
    }
}
