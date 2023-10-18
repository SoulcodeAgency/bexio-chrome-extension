import React, { useContext } from "react";
import { Modal, Form, Input, Select, Switch } from "antd";
import { TemplateContextType, TemplateContext } from "~/TemplateContext";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";
import { updateTemplate } from "@bexio-chrome-extension/shared/chromeStorageTemplateEntries";

interface Props {
  templateId: string;
  closeModal: () => void;
}

const { Option } = Select;

const MyComponent: React.FC<Props> = ({ templateId, closeModal }) => {
  const [form] = Form.useForm();

  const { templates: templateEntries, reloadData } =
    useContext<TemplateContextType>(TemplateContext);

  const template = templateEntries.find(
    (template) => template.id === templateId
  );

  const handleSave = async (template: TemplateEntry) => {
    console.log("handleSave", template);
    await updateTemplate(template);
    reloadData();
    closeModal();
  };

  const handleCancel = () => {
    closeModal();
  };

  return (
    <div>
      <Modal
        title="Template Details"
        open={true}
        onOk={() => form.submit()}
        onCancel={handleCancel}
        width={600}
        okText="Save"
      >
        <Form
          form={form}
          onFinish={handleSave}
          labelCol={{ span: 6 }}
          wrapperCol={{ span: 14 }}
          initialValues={{
            templateName: template?.templateName,
            keywords: template?.keywords,
            contact: template?.contact,
            project: template?.project,
            package: template?.package,
            contactPerson: template?.contactPerson,
            billable: template?.billable,
            status: template?.status,
            work: template?.work,
          }}
        >
          <h2>Template values</h2>
          <Form.Item
            label="Template Name"
            name="templateName"
            style={{ fontWeight: "bold" }}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Keywords"
            name="keywords"
            style={{ fontWeight: "bold" }}
          >
            <Input />
          </Form.Item>
          <hr />
          <h2>Bexio values</h2>
          <p>
            ⚠️ Be careful changing these values, you can break your template.
          </p>
          <Form.Item label="Contact" name="contact">
            <Input />
          </Form.Item>
          <Form.Item label="Project" name="project">
            <Input />
          </Form.Item>
          <Form.Item label="Package" name="package">
            <Input />
          </Form.Item>
          <Form.Item label="Contact Person" name="contactPerson">
            <Input />
          </Form.Item>
          <Form.Item label="Billable" name="billable" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Status" name="status">
            <Select>
              <Option value="Offen">Offen</Option>
              <Option value="In Arbeit">In Arbeit</Option>
              <Option value="Erledigt">Erledigt</Option>
              <Option value="Fakturiert">Fakturiert</Option>
              <Option value="Geschlossen">Geschlossen</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Work" name="work">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MyComponent;
