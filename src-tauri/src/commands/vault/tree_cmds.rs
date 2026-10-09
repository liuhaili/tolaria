use crate::vault::{self, VaultTree};

use super::boundary::with_boundary;

/// Read `{vault}/tolaria/config/tree.yml`. A missing file yields the empty tree.
#[tauri::command]
pub fn load_vault_tree(vault_path: String) -> Result<VaultTree, String> {
    with_boundary(Some(vault_path.as_str()), |boundary| {
        Ok(vault::read_vault_tree(boundary.requested_root()))
    })
}

/// Write the tree definition, dropping records whose target is gone (ADR 0188).
#[tauri::command]
pub fn save_vault_tree(vault_path: String, tree: VaultTree) -> Result<(), String> {
    with_boundary(Some(vault_path.as_str()), |boundary| {
        let root = boundary.requested_root();
        let mut tree = tree;
        vault::prune_missing_nodes(root, &mut tree);
        vault::write_vault_tree(root, &tree)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vault::VaultTreeNodeRecord;
    use std::fs;

    fn record(parent: Option<&str>, icon: Option<&str>) -> VaultTreeNodeRecord {
        VaultTreeNodeRecord {
            parent: parent.map(str::to_string),
            order: None,
            icon: icon.map(str::to_string),
        }
    }

    #[test]
    fn tree_commands_roundtrip_through_validated_vault_paths() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path().to_string_lossy().to_string();
        fs::write(dir.path().join("project.md"), "# Project").unwrap();
        fs::write(dir.path().join("diagram.drawio"), "<mxfile/>").unwrap();

        assert!(load_vault_tree(vault_path.clone())
            .unwrap()
            .nodes
            .is_empty());

        let mut tree = VaultTree::default();
        tree.nodes
            .insert("diagram.drawio".to_string(), record(Some("project.md"), Some("blueprint")));
        save_vault_tree(vault_path.clone(), tree).unwrap();

        let loaded = load_vault_tree(vault_path).unwrap();
        assert_eq!(
            loaded.nodes.get("diagram.drawio"),
            Some(&record(Some("project.md"), Some("blueprint")))
        );
    }

    #[test]
    fn saving_drops_records_whose_target_no_longer_exists() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path().to_string_lossy().to_string();
        fs::write(dir.path().join("keep.md"), "# Keep").unwrap();

        let mut tree = VaultTree::default();
        tree.nodes.insert("keep.md".to_string(), record(None, Some("star")));
        tree.nodes.insert("gone.md".to_string(), record(None, Some("ghost")));
        save_vault_tree(vault_path.clone(), tree).unwrap();

        let loaded = load_vault_tree(vault_path).unwrap();
        assert_eq!(loaded.nodes.len(), 1);
        assert!(loaded.nodes.contains_key("keep.md"));
    }
}
